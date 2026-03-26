export interface InboxTask {
  filePath: string;
  title: string;
  status: string;
  deadline: string | null;
  deadlineDate: Date | null;
  description: string;
  todos: TodoItem[];
  daysRemaining: number | null;
}

export interface TodoItem {
  text: string;
  completed: boolean;
  line: number;
}
