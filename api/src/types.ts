export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const SORT_FIELDS = ['createdAt', 'dueDate', 'title', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null; // YYYY-MM-DD
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  passwordHash: string;
}

export interface TaskInput {
  title: string;
  description: string | null;
  dueDate: string | null;
  status: Status;
}

export interface TaskQuery {
  status?: Status;
  search?: string;
  sort: SortField;
  order: 'asc' | 'desc';
}

/** Everything the routes need from storage. One real implementation (SQL Server) and one in-memory one for tests. */
export interface Repo {
  findUserByEmail(email: string): Promise<User | null>;
  createUser(email: string, passwordHash: string): Promise<User | null>; // null when the email is taken
  listTasks(userId: number, query: TaskQuery): Promise<Task[]>;
  getTask(userId: number, id: number): Promise<Task | null>;
  createTask(userId: number, input: TaskInput): Promise<Task>;
  updateTask(userId: number, id: number, input: Partial<TaskInput>): Promise<Task | null>;
  deleteTask(userId: number, id: number): Promise<boolean>;
}
