import { Task } from '@/types/task';
import { GripVertical, Trash2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSSProperties } from 'react';
import ProgressBar from './ProgressBar';

const quadrantColor: Record<number, string> = {
  1: '#FF8A8A',
  2: '#7CB9E8',
  3: '#FFB976',
  4: '#B8B8B8',
};

interface TaskCardProps {
  task: Task;
  onDelete: (taskId: string) => void;
  isOverlay?: boolean;
}

export default function TaskCard({ task, onDelete, isOverlay = false }: TaskCardProps) {
  const progress = Math.max(0, Math.min(100, task.progress));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: isOverlay,
  });
  const style = {
    '--task-accent': quadrantColor[task.quadrant],
  } as CSSProperties;

  return (
    <article ref={isOverlay ? undefined : setNodeRef} className={`task-card ${isDragging ? 'is-dragging' : ''} ${isOverlay ? 'is-overlay' : ''}`} style={style}>
      <div className="task-card-header">
        <div className="task-title-row">
          <button
            className="drag-handle"
            aria-label={`拖动任务：${task.title}`}
            type="button"
            {...(isOverlay ? {} : listeners)}
            {...(isOverlay ? {} : attributes)}
          >
            <GripVertical size={15} />
          </button>
          <h3>{task.title}</h3>
        </div>
        <div className="task-card-actions">
          <span>{progress}%</span>
          <button className="icon-button" aria-label={`删除任务：${task.title}`} onClick={() => onDelete(task.id)} disabled={isOverlay} type="button">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p>当前进度</p>
      <ProgressBar progress={progress} />
      {task.ai_reasoning ? <div className="task-reasoning">{task.ai_reasoning}</div> : null}
    </article>
  );
}
