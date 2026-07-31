export type Role = "admin" | "brand_leader" | "employee";

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface Season {
  id: string;
  customer_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface WorkflowStepTemplate {
  id: string;
  customer_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Style {
  id: string;
  customer_id: string;
  season_id: string;
  style_code: string;
  style_name: string | null;
  active: boolean;
  created_at: string;
}

export interface StyleAssignment {
  id: string;
  style_id: string;
  employee_id: string;
}

export interface StyleProgress {
  id: string;
  style_id: string;
  step_template_id: string;
  deadline_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  is_completed: boolean;
  remark: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type ProgressStatus =
  | "done_on_time"
  | "done_late"
  | "overdue"
  | "at_risk"
  | "in_progress"
  | "not_started";

export const STATUS_LABEL_VI: Record<ProgressStatus, string> = {
  done_on_time: "Hoàn thành đúng hạn",
  done_late: "Hoàn thành trễ hạn",
  overdue: "Quá hạn",
  at_risk: "Nguy cơ trễ",
  in_progress: "Đang thực hiện",
  not_started: "Chưa bắt đầu",
};
