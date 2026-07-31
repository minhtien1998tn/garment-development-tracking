import type { ProgressStatus } from "@/lib/types";
import { STATUS_BADGE_CLASS } from "@/lib/status";
import { STATUS_LABEL_VI } from "@/lib/types";

export function StatusBadge({ status }: { status: ProgressStatus }) {
  return <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABEL_VI[status]}</span>;
}
