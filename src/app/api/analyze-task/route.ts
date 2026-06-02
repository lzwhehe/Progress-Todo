import { NextResponse } from 'next/server';

type Quadrant = 1 | 2 | 3 | 4;

interface AnalyzeTaskRequest {
  input?: string;
  existingTasks?: Array<{ id: string; title: string }>;
  config?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

interface TaskAnalysis {
  title: string;
  quadrant: Quadrant;
  progress: number;
  reasoning: string;
  matchedTaskId: string | null;
}

const titleCaseReport = (value: string) => value.replace(/\breport\s*(\d*)\b/gi, (_, number) => `Report${number ? ` ${number}` : ''}`);

const splitTaskInput = (input: string) => {
  const normalized = input
    .replace(/\r/g, '\n')
    .replace(/(?:^|\s)(\d+)[.、)]\s*/g, '\n')
    .replace(/[；;]/g, '\n');

  const parts = normalized
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [input];
};

const extractTaskTitle = (input: string) => {
  const withoutMeta = input
    .replace(/\d{1,2}[./-]\d{1,2}\s*(前|之前|截止|ddl|deadline)?/gi, '')
    .replace(/(今天|今晚|明天|后天|本周|这周|下周)\s*(前|之前|截止|ddl|deadline)?/g, '')
    .replace(/(截止|ddl|deadline|到期|老师布置的|老师安排的|老师给的|一个|一份|的)/gi, ' ')
    .replace(/(进度|完成度)?\s*\d{1,3}\s*%/g, '')
    .replace(/[。！？!?,，；;：:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized = titleCaseReport(withoutMeta);
  if (/^Report\s*\d*/i.test(normalized)) return `完成 ${normalized}`.trim();
  if (normalized) return normalized.slice(0, 24);

  return '未命名任务';
};

const fallbackAnalysis = (input: string, existingTasks: AnalyzeTaskRequest['existingTasks'] = []): TaskAnalysis => {
  const percent = input.match(/(\d{1,3})\s*%/);
  const important = /重要|关键|客户|老板|核心|项目|收入|合同|发布|演示|面试|考试|健康|家人/.test(input);
  const urgent = /今天|今晚|明天|马上|立刻|紧急|截止|ddl|deadline|到期|催|临近|尽快/.test(input);
  const matchedTask = existingTasks.find((task) => input.replace(/\s/g, '').includes(task.title.replace(/\s/g, '')));

  let progress = 25;
  if (percent) progress = Number(percent[1]);
  else if (/完成|搞定|结束|上线|交付/.test(input)) progress = 100;
  else if (/收尾|最后|验收|测试/.test(input)) progress = 80;
  else if (/一半|半|推进中|进行中/.test(input)) progress = 50;
  else if (/开始|刚|准备|计划|还没/.test(input)) progress = 10;

  const quadrant = important && urgent ? 1 : important ? 2 : urgent ? 3 : 4;

  return {
    title: extractTaskTitle(input),
    quadrant,
    progress: Math.max(0, Math.min(100, progress)),
    reasoning: matchedTask
      ? `根据描述命中已有任务，并重新判断为 Q${quadrant}。`
      : `根据重要性和紧急性判断为 Q${quadrant}。`,
    matchedTaskId: matchedTask?.id ?? null,
  };
};

const fallbackAnalyses = (input: string, existingTasks: AnalyzeTaskRequest['existingTasks'] = []) => (
  splitTaskInput(input).map((part) => fallbackAnalysis(part, existingTasks))
);

const normalizeAnalysis = (value: unknown, input: string, existingTasks: AnalyzeTaskRequest['existingTasks']): TaskAnalysis => {
  const fallback = fallbackAnalysis(input, existingTasks);
  if (!value || typeof value !== 'object') return fallback;

  const candidate = value as Partial<TaskAnalysis>;
  const quadrant = Number(candidate.quadrant);
  const progress = Number(candidate.progress);

  return {
    title: typeof candidate.title === 'string' && candidate.title.trim() ? extractTaskTitle(candidate.title) : fallback.title,
    quadrant: quadrant >= 1 && quadrant <= 4 ? (quadrant as Quadrant) : fallback.quadrant,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : fallback.progress,
    reasoning: typeof candidate.reasoning === 'string' && candidate.reasoning.trim() ? candidate.reasoning.trim() : fallback.reasoning,
    matchedTaskId: typeof candidate.matchedTaskId === 'string' ? candidate.matchedTaskId : fallback.matchedTaskId,
  };
};

const normalizeAnalyses = (value: unknown, input: string, existingTasks: AnalyzeTaskRequest['existingTasks']) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeAnalysis(item, splitTaskInput(input)[index] ?? input, existingTasks));
  }

  if (value && typeof value === 'object') {
    const candidate = value as { tasks?: unknown; analyses?: unknown; analysis?: unknown };
    const taskList = candidate.tasks ?? candidate.analyses;
    if (Array.isArray(taskList)) {
      return taskList.map((item, index) => normalizeAnalysis(item, splitTaskInput(input)[index] ?? input, existingTasks));
    }
    if (candidate.analysis) {
      return [normalizeAnalysis(candidate.analysis, input, existingTasks)];
    }
  }

  return fallbackAnalyses(input, existingTasks);
};

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeTaskRequest;
  const input = body.input?.trim();
  const existingTasks = body.existingTasks ?? [];
  const customConfig = body.config ?? {};

  if (!input) {
    return NextResponse.json({ error: 'Missing task input.' }, { status: 400 });
  }

  const apiKey = customConfig.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = customConfig.baseUrl || process.env.AI_API_BASE_URL || 'https://api.openai.com/v1';
  const model = customConfig.model || process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    const analyses = fallbackAnalyses(input, existingTasks);
    return NextResponse.json({ analysis: analyses[0], analyses, source: 'fallback' });
  }

  const prompt = [
    '你是一个任务管理助手。请根据用户自然语言判断任务标题、四象限和当前进度。',
    '用户可能一次输入多个任务，例如“1. 完成report1 2. 去汤泉 3. 改作业”。这种情况必须拆成多个任务，tasks 数组里每个任务一个对象。',
    'title 必须是短任务名，像待办事项标题一样，不要原样复述用户输入。',
    'title 要去掉截止日期、时间状语、来源描述和口语填充词，例如“5.31 截止的一个老师布置的report2”应输出“完成 Report 2”。',
    '如果用户输入是作业、论文、report、presentation、考试复习等，title 应使用动作动词，例如“完成 Report 2”“准备 Presentation”“复习期末考试”。',
    '四象限定义：Q1=重要且紧急，Q2=重要不紧急，Q3=紧急不重要，Q4=不重要不紧急。',
    '如果用户描述是在更新已有任务，请从 existingTasks 中选择匹配任务 id；否则 matchedTaskId 为 null。',
    '只输出 JSON，不要 Markdown。',
    `existingTasks=${JSON.stringify(existingTasks)}`,
    `userInput=${input}`,
    'JSON schema: {"tasks":[{"title":"string","quadrant":1|2|3|4,"progress":0-100,"reasoning":"中文一句话","matchedTaskId":"string|null"}]}',
  ].join('\n');

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你只返回一个可解析 JSON 对象。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      const analyses = fallbackAnalyses(input, existingTasks);
      return NextResponse.json(
        { analysis: analyses[0], analyses, source: 'fallback', error: details.slice(0, 280) },
        { status: 200 },
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : null;
    const analyses = normalizeAnalyses(parsed, input, existingTasks);

    return NextResponse.json({ analysis: analyses[0], analyses, source: 'ai' });
  } catch (error) {
    const analyses = fallbackAnalyses(input, existingTasks);
    return NextResponse.json({
      analysis: analyses[0],
      analyses,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown AI error',
    });
  }
}
