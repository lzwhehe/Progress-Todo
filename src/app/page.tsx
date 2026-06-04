"use client";

import QuadrantBoard from '@/components/QuadrantBoard';
import { Quadrant, Task } from '@/types/task';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Send, Sparkles, RefreshCcw, Settings, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TaskAnalysis {
  title: string;
  quadrant: Quadrant;
  progress: number;
  reasoning: string;
  matchedTaskId: string | null;
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [aiConfig, setAiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  });

  const [manualTitle, setManualTitle] = useState('');
  const [manualQuadrant, setManualQuadrant] = useState<Quadrant>(2);
  const [manualProgress, setManualProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [latestDecision, setLatestDecision] = useState('正在初始化身份...');

  const canSubmit = input.trim().length > 0;
  const canSubmitManual = manualTitle.trim().length > 0;
  const activeTasks = useMemo(() => tasks.filter((task) => task.status === 'active'), [tasks]);

  // Initial load: User Identity + Data
  useEffect(() => {
    // 1. 获取或创建合法的 UUID 身份
    let id = localStorage.getItem('progress-todo.user-id');
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem('progress-todo.user-id', id);
    }
    setUserId(id);

    // 2. 加载 AI 配置
    const savedConfig = localStorage.getItem('progress-todo.ai-config');
    if (savedConfig) {
      try {
        setAiConfig(JSON.parse(savedConfig));
      } catch (e) {}
    }

    // 3. 加载该用户的任务
    async function loadTasks() {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setTasks(data as Task[]);
        setLatestDecision(data.length > 0 ? '已同步你的云端任务' : '云端目前没有你的任务');
      } else if (error) {
        console.error('Fetch error:', error.message);
        setLatestDecision('同步失败: ' + error.message);
      }
      setIsHydrated(true);
      setIsSyncing(false);
    }
    loadTasks();
  }, []);

  // 保存 AI 配置
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('progress-todo.ai-config', JSON.stringify(aiConfig));
    }
  }, [aiConfig, isHydrated]);

  async function handleFetchTasks() {
    if (!userId) return;
    setIsSyncing(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setTasks(data as Task[]);
    }
    setIsSyncing(false);
  }

  function inferProgress(input: string) {
    const percent = input.match(/(\d{1,3})\s*%/);
    if (percent) return Math.max(0, Math.min(100, Number(percent[1])));
    if (/完成|搞定|结束|上线|交付/.test(input)) return 100;
    if (/收尾|最后|验收|测试/.test(input)) return 80;
    if (/一半|半|推进中|进行中/.test(input)) return 50;
    if (/开始|刚|准备|计划|还没/.test(input)) return 10;
    return 25;
  }

  function inferQuadrant(input: string): { quadrant: Quadrant; reasoning: string } {
    const important = /重要|关键|客户|老板|核心|项目|收入|合同|发布|演示|面试|考试|健康|家人/.test(input);
    const urgent = /今天|今晚|明天|马上|立刻|紧急|截止|ddl|deadline|到期|催|临近|尽快/.test(input);
    if (important && urgent) return { quadrant: 1, reasoning: '这件事同时重要且有明确时间压力，归入 Q1。' };
    if (important) return { quadrant: 2, reasoning: '这件事对长期目标重要，但暂时没有明显紧急信号，归入 Q2。' };
    if (urgent) return { quadrant: 3, reasoning: '这件事有时间压力，但重要性信号较弱，归入 Q3。' };
    return { quadrant: 4, reasoning: '暂未识别到明显重要性或紧急性，归入 Q4。' };
  }

  function extractTitle(input: string) {
    return input.replace(/(进度|完成度)?\s*\d{1,3}\s*%/g, '').replace(/[。！？!?,，；;：:]+$/g, '').trim().slice(0, 32) || '未命名任务';
  }

  function normalizeText(text: string) {
    return text.replace(/\s/g, '').toLowerCase();
  }

  function findRelatedTask(input: string, tasks: Task[]) {
    const normalizedInput = normalizeText(input);
    return tasks.find((task) => {
      const normalizedTitle = normalizeText(task.title);
      if (normalizedInput.includes(normalizedTitle)) return true;
      if (normalizedTitle.length >= 6 && normalizedInput.includes(normalizedTitle.slice(0, 6))) return true;
      return normalizedTitle.length >= 4 && normalizedInput.includes(normalizedTitle.slice(0, 4));
    });
  }

  async function applyAnalyses(content: string, analyses: TaskAnalysis[], source: 'ai' | 'fallback') {
    const now = new Date().toISOString();
    const sourceLabel = source === 'ai' ? 'AI' : '本地规则';
    
    for (const analysis of analyses) {
      const relatedTask = analysis.matchedTaskId
        ? tasks.find(t => t.id === analysis.matchedTaskId)
        : findRelatedTask(analysis.title, tasks);

      if (relatedTask) {
        const updates = {
          title: analysis.title || relatedTask.title,
          description: content,
          quadrant: analysis.quadrant,
          progress: analysis.progress,
          ai_generated: true,
          ai_reasoning: `${analysis.reasoning}（${sourceLabel} 判断）`,
          updated_at: now,
        };
        
        setTasks(prev => prev.map(t => t.id === relatedTask.id ? { ...t, ...updates } : t));
        const { error } = await supabase.from('tasks').update(updates).eq('id', relatedTask.id);
        if (error) console.error('Update failed:', error.message);
      } else {
        const newTask: Task = {
          id: crypto.randomUUID(),
          user_id: userId,
          title: analysis.title,
          description: content,
          quadrant: analysis.quadrant,
          progress: analysis.progress,
          status: 'active',
          ai_generated: true,
          ai_reasoning: `${analysis.reasoning}（${sourceLabel} 判断）`,
          created_at: now,
          updated_at: now,
        };
        
        setTasks(prev => [newTask, ...prev]);
        const { error } = await supabase.from('tasks').insert([newTask]);
        if (error) {
          console.error('Insert failed:', error.message);
          setLatestDecision('保存失败: ' + error.message);
        }
      }
    }

    if (analyses.length === 1) {
      const [analysis] = analyses;
      setLatestDecision(`已同步：${analysis.title} · Q${analysis.quadrant}`);
    } else {
      setLatestDecision(`已同步 ${analyses.length} 个任务`);
    }
  }

  async function addTaskFromConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content) return;

    setIsAnalyzing(true);
    setLatestDecision('AI 正在分析...');

    try {
      const response = await fetch('/api/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: content,
          existingTasks: tasks.map((task) => ({ id: task.id, title: task.title })),
          config: aiConfig.apiKey ? aiConfig : undefined
        }),
      });

      if (!response.ok) throw new Error('AI route failed');

      const data = await response.json() as { analysis: TaskAnalysis; analyses?: TaskAnalysis[]; source: 'ai' | 'fallback' };
      await applyAnalyses(content, data.analyses?.length ? data.analyses : [data.analysis], data.source);
      setInput('');
    } catch (error) {
      const { quadrant, reasoning } = inferQuadrant(content);
      await applyAnalyses(content, [{
        title: extractTitle(content),
        quadrant,
        progress: inferProgress(content),
        reasoning,
        matchedTaskId: findRelatedTask(content, tasks)?.id ?? null,
      }], 'fallback');
      setInput('');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function deleteTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    setTasks((current) => current.filter((item) => item.id !== taskId));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('Delete failed:', error.message);
    if (task) setLatestDecision(`已删除：${task.title}`);
  }

  async function moveTask(taskId: string, quadrant: Quadrant) {
    const now = new Date().toISOString();
    const task = tasks.find((item) => item.id === taskId);
    setTasks((current) => current.map((item) => (
      item.id === taskId ? { ...item, quadrant, updated_at: now } : item
    )));
    const { error } = await supabase.from('tasks').update({ quadrant, updated_at: now }).eq('id', taskId);
    if (error) console.error('Move failed:', error.message);
    if (task) setLatestDecision(`已移动：${task.title} · Q${quadrant}`);
  }

  async function addManualTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = manualTitle.trim();
    if (!title || !userId) return;

    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      quadrant: manualQuadrant,
      progress: manualProgress,
      status: 'active',
      ai_generated: false,
      created_at: now,
      updated_at: now,
    };

    setTasks((current) => [task, ...current]);
    const { error } = await supabase.from('tasks').insert([task]);
    if (error) console.error('Manual add failed:', error.message);
    setLatestDecision(`已手动添加：${title}`);
    setManualTitle('');
    setManualQuadrant(2);
    setManualProgress(0);
    setIsManualOpen(false);
  }

  if (!isHydrated) return null;

  return (
    <main className="app-shell">
      <form className="top-bar" onSubmit={addTaskFromConversation}>
        <div className="ai-command">
          <Sparkles size={17} strokeWidth={2.2} />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="告诉 AI 你正在做什么..."
            aria-label="用自然语言添加任务"
          />
        </div>
        <div className="toolbar-actions">
          <button 
            className="button button-secondary"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            type="button"
            title="AI 配置"
          >
            <Settings size={16} />
          </button>
          <button 
            className={`button button-secondary ${isSyncing ? 'animate-spin' : ''}`}
            onClick={handleFetchTasks}
            disabled={isSyncing}
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
          <button className="button button-primary" disabled={!canSubmit || isAnalyzing} type="submit">
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isAnalyzing ? '分析中' : '发送'}
          </button>
          <button
            className="button button-secondary"
            aria-label="手动添加任务"
            type="button"
            onClick={() => setIsManualOpen((current) => !current)}
          >
            <Plus size={17} />
          </button>
        </div>
      </form>

      {isSettingsOpen && (
        <div className="manual-panel ai-settings-panel">
          <label className="manual-field">
            <span>API Key</span>
            <input 
              type="password"
              value={aiConfig.apiKey} 
              onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})} 
              placeholder="sk-..." 
            />
          </label>
          <label className="manual-field">
            <span>Base URL</span>
            <input 
              value={aiConfig.baseUrl} 
              onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})} 
              placeholder="https://..." 
            />
          </label>
          <label className="manual-field">
            <span>模型 (Model)</span>
            <input 
              value={aiConfig.model} 
              onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})} 
              placeholder="qwen-plus" 
            />
          </label>
        </div>
      )}

      {isManualOpen ? (
        <form className="manual-panel" onSubmit={addManualTask}>
          <label className="manual-field manual-title-field">
            <span>任务</span>
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="任务名称" />
          </label>
          <label className="manual-field">
            <span>象限</span>
            <select value={manualQuadrant} onChange={(event) => setManualQuadrant(Number(event.target.value) as Quadrant)}>
              <option value={1}>Q1 重要且紧急</option>
              <option value={2}>Q2 重要不紧急</option>
              <option value={3}>Q3 紧急不重要</option>
              <option value={4}>Q4 不重要不紧急</option>
            </select>
          </label>
          <label className="manual-field manual-progress-field">
            <span>进度 {manualProgress}%</span>
            <input value={manualProgress} onChange={(event) => setManualProgress(Number(event.target.value))} type="range" min="0" max="100" step="5" />
          </label>
          <button className="button button-primary" disabled={!canSubmitManual} type="submit">添加</button>
        </form>
      ) : null}
      <p className={`ai-status ${isAnalyzing ? 'is-analyzing' : ''}`}>
        {isAnalyzing && <Loader2 size={13} className="animate-spin ai-status-spinner" />}
        <span>{latestDecision}</span>
        {isAnalyzing && <span className="ai-status-dots" aria-hidden="true" />}
      </p>
      <QuadrantBoard tasks={activeTasks} onDeleteTask={deleteTask} onMoveTask={moveTask} />
    </main>
  );
}
