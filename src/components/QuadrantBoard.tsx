"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { Task } from '@/types/task';
import TaskCard from './TaskCard';

const quadrantMeta = [
  { q: 1 as const, title: '重要且紧急', tip: '现在处理', tone: 'coral' },
  { q: 2 as const, title: '重要不紧急', tip: '安排节奏', tone: 'blue' },
  { q: 3 as const, title: '紧急不重要', tip: '快速处理', tone: 'amber' },
  { q: 4 as const, title: '不重要不紧急', tip: '保持克制', tone: 'gray' },
];

interface QuadrantBoardProps {
  tasks: Task[];
  onDeleteTask: (taskId: string) => void;
  onMoveTask: (taskId: string, quadrant: Task['quadrant']) => void;
}

interface QuadrantPanelProps {
  meta: (typeof quadrantMeta)[number];
  tasks: Task[];
  onDeleteTask: (taskId: string) => void;
}

import { AnimatePresence } from 'framer-motion';

function QuadrantPanel({ meta, tasks, onDeleteTask }: QuadrantPanelProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `quadrant-${meta.q}`,
    data: { quadrant: meta.q },
  });

  return (
    <section ref={setNodeRef} className={`quadrant-panel tone-${meta.tone} ${isOver ? 'is-over' : ''}`}>
      <div className="quadrant-heading">
        <span className="quadrant-index">Q{meta.q}</span>
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.tip}</p>
        </div>
        <span className="task-count">{tasks.length}</span>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDelete={onDeleteTask} />
        ))}
        {tasks.length === 0 ? <div className="empty-state">拖到这里，或等待 AI 放入任务</div> : null}
      </div>
    </section>
  );
}

export default function QuadrantBoard({ tasks, onDeleteTask, onMoveTask }: QuadrantBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const quadrant = event.over?.data.current?.quadrant as Task['quadrant'] | undefined;
    setActiveTaskId(null);
    if (!quadrant) return;

    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.quadrant === quadrant) return;

    onMoveTask(taskId, quadrant);
  }

  return (
    <DndContext id="task-quadrant-board" onDragStart={handleDragStart} onDragCancel={() => setActiveTaskId(null)} onDragEnd={handleDragEnd}>
      <div className="quadrant-grid">
        {quadrantMeta.map((meta) => (
          <QuadrantPanel
            key={meta.q}
            meta={meta}
            tasks={tasks.filter((task) => task.quadrant === meta.q)}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} onDelete={onDeleteTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
