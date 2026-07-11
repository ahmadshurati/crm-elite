export const TASK_TYPES = ["call", "meeting", "follow-up", "email", "personal"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["pending", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskTypeLabels: Record<TaskType, string> = {
  call: "تذكير اتصال",
  meeting: "اجتماع",
  "follow-up": "متابعة",
  email: "تذكير بريد",
  personal: "مهمة شخصية",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  done: "منجزة",
  cancelled: "ملغاة",
};

export type CrmTaskRecord = {
  id: number;
  customerId: number | null;
  assignedUserId: number | null;
  createdByUserId: number | null;
  title: string;
  type: TaskType | string;
  description: string | null;
  dueDate: string;
  dueTime: string | null;
  priority: TaskPriority | string;
  status: TaskStatus | string;
  customerName?: string | null;
  assignedUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};
