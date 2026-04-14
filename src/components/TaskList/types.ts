// Tipi condivisi per i componenti della TaskList
export interface Task {
  status: string;
  start_time: string;
  id?: number | string;
  title: string;
  image?: string;
  description: string;
  priority: string;
  end_time: string;
  completed?: boolean;
  status_code?: number;
  task_id?: number | string;
  category_id?: number | string;
  category_name?: string;
  isOptimistic?: boolean;
  duration_minutes?: number | null;
  // Recurring task fields
  recurring_task_id?: number;
  is_recurring?: boolean;
  is_active?: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_day_of_month?: number;
  recurrence_end_type?: string;
  recurrence_end_date?: string;
  recurrence_end_count?: number;
  next_occurrence?: string;
  last_completed_at?: string;
  is_generated_instance?: boolean;
  [key: string]: any;
}

// Riferimento globale per i task condivisi tra componenti
export let globalTasksRef = {
  addTask: (task: Task, categoryName: string) => {},
  tasks: {} as Record<string, Task[]>, // Task raggruppati per nome categoria
};

// Funzione globale per aggiungere task
export const addTaskToList = (task: Task, categoryName: string) => {
  console.log(
    "addTaskToList called directly with:",
    task,
    "for category:",
    categoryName
  );
  globalTasksRef.addTask(task, categoryName);
};
