/** Supported task states; the tuple also provides a runtime list for validation. */
export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];

/** Fields that task lists can sort by. */
export const SORT_FIELDS = ['createdAt', 'dueDate', 'title', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface Task {
  id: number;
  title: string;
  /** Optional user-provided details; null when none were supplied. */
  description: string | null;
  /** Calendar date in YYYY-MM-DD format; null when no due date is set. */
  dueDate: string | null; // YYYY-MM-DD
  status: Status;
  /** ISO timestamps maintained by the repository. */
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  /** One-way password hash; plaintext passwords must never be stored here. */
  passwordHash: string;
}

/** Validated fields used when creating or updating a task. */
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
  /** All task operations are scoped to the supplied owner ID. */
  listTasks(userId: number, query: TaskQuery): Promise<Task[]>;
  getTask(userId: number, id: number): Promise<Task | null>;
  createTask(userId: number, input: TaskInput): Promise<Task>;
  updateTask(userId: number, id: number, input: Partial<TaskInput>): Promise<Task | null>;
  deleteTask(userId: number, id: number): Promise<boolean>;
}
