import { StatusBadge } from "./StatusBadge";
import { computeStatus } from "@/lib/status";
import type { StyleProgress, WorkflowStepTemplate } from "@/lib/types";

interface Props {
  steps: WorkflowStepTemplate[];
  progressByStep: Map<string, StyleProgress>;
  canEditDeadline: boolean;
  onFieldChange: (
    stepId: string,
    field: "deadline_date" | "expected_completion_date" | "is_completed" | "remark",
    value: string | boolean
  ) => void;
}

function emptyRow(stepId: string): StyleProgress {
  return {
    id: "",
    style_id: "",
    step_template_id: stepId,
    deadline_date: null,
    expected_completion_date: null,
    actual_completion_date: null,
    is_completed: false,
    remark: null,
    updated_by: null,
    updated_at: "",
  };
}

export function ProgressMatrix({ steps, progressByStep, canEditDeadline, onFieldChange }: Props) {
  if (steps.length === 0) return null;

  const rowLabelCol = "150px";
  const stepCols = `repeat(${steps.length}, minmax(140px, 1fr))`;

  return (
    <div className="matrix-scroll">
      <div className="matrix-grid" style={{ gridTemplateColumns: `${rowLabelCol} ${stepCols}` }}>
        <div className="matrix-cell matrix-row-label" />
        {steps.map((s) => (
          <div key={s.id} className="matrix-cell matrix-col-header">
            {s.name}
          </div>
        ))}

        <div className="matrix-cell matrix-row-label">Deadline</div>
        {steps.map((s) => {
          const row = progressByStep.get(s.id) ?? emptyRow(s.id);
          return (
            <div key={s.id} className="matrix-cell">
              <input
                type="date"
                disabled={!canEditDeadline}
                value={row.deadline_date?.slice(0, 10) ?? ""}
                onChange={(e) => onFieldChange(s.id, "deadline_date", e.target.value)}
                style={cellInputStyle}
              />
            </div>
          );
        })}

        <div className="matrix-cell matrix-row-label">Dự kiến hoàn thành</div>
        {steps.map((s) => {
          const row = progressByStep.get(s.id) ?? emptyRow(s.id);
          return (
            <div key={s.id} className="matrix-cell">
              <input
                type="date"
                disabled={row.is_completed}
                value={row.expected_completion_date?.slice(0, 10) ?? ""}
                onChange={(e) => onFieldChange(s.id, "expected_completion_date", e.target.value)}
                style={cellInputStyle}
              />
            </div>
          );
        })}

        <div className="matrix-cell matrix-row-label">Hoàn thành</div>
        {steps.map((s) => {
          const row = progressByStep.get(s.id) ?? emptyRow(s.id);
          return (
            <div key={s.id} className="matrix-cell" style={{ textAlign: "center" }}>
              <input
                type="checkbox"
                checked={row.is_completed}
                onChange={(e) => onFieldChange(s.id, "is_completed", e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
            </div>
          );
        })}

        <div className="matrix-cell matrix-row-label">Trạng thái</div>
        {steps.map((s) => {
          const row = progressByStep.get(s.id) ?? emptyRow(s.id);
          return (
            <div key={s.id} className="matrix-cell">
              <StatusBadge status={computeStatus(row)} />
            </div>
          );
        })}

        <div className="matrix-cell matrix-row-label">Remark</div>
        {steps.map((s) => {
          const row = progressByStep.get(s.id) ?? emptyRow(s.id);
          return (
            <div key={s.id} className="matrix-cell">
              <input
                type="text"
                defaultValue={row.remark ?? ""}
                onBlur={(e) => onFieldChange(s.id, "remark", e.target.value)}
                placeholder="—"
                style={cellInputStyle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cellInputStyle = {
  width: "100%",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "5px 6px",
  fontSize: 12.5,
  fontFamily: "var(--font-mono)",
};
