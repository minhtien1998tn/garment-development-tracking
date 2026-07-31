import type { ProgressStatus, StyleProgress } from "./types";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toTime(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Single source of truth for progress status — reused by timeline, matrix grid and dashboard. */
export function computeStatus(
  row: Pick<
    StyleProgress,
    "is_completed" | "deadline_date" | "expected_completion_date" | "actual_completion_date"
  >
): ProgressStatus {
  const today = startOfToday();
  const deadline = toTime(row.deadline_date);

  if (row.is_completed) {
    const actual = toTime(row.actual_completion_date);
    if (deadline !== null && actual !== null && actual > deadline) return "done_late";
    return "done_on_time";
  }

  if (deadline !== null && deadline < today) return "overdue";

  const expected = toTime(row.expected_completion_date);
  if (deadline !== null && expected !== null && expected > deadline) return "at_risk";

  if (deadline === null && expected === null) return "not_started";

  return "in_progress";
}

export const STATUS_COLOR: Record<ProgressStatus, string> = {
  done_on_time: "var(--color-green)",
  done_late: "var(--color-amber)",
  overdue: "var(--color-rose)",
  at_risk: "var(--color-amber)",
  in_progress: "var(--color-blue)",
  not_started: "var(--color-gray)",
};

export const STATUS_BADGE_CLASS: Record<ProgressStatus, string> = {
  done_on_time: "badge-green",
  done_late: "badge-amber",
  overdue: "badge-rose",
  at_risk: "badge-amber",
  in_progress: "badge-blue",
  not_started: "badge-gray",
};
