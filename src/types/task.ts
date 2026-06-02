export type Quadrant = 1 | 2 | 3 | 4;

export interface Checkpoint {
  id: string;
  task_id: string;
  title: string;
  weight: number;
  is_completed: boolean;
  order: number;
  completed_at?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  quadrant: Quadrant;
  progress: number;
  status: 'active' | 'completed' | 'archived';
  due_date?: string;
  ai_generated: boolean;
  ai_reasoning?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  checkpoints?: Checkpoint[];
}
