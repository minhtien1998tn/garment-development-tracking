import { Link } from "react-router-dom";
import { computeStatus, STATUS_COLOR, STATUS_BADGE_CLASS } from "@/lib/status";
import { formatDateVi } from "@/lib/date";
import { STATUS_LABEL_VI } from "@/lib/types";
import type { StyleProgress, WorkflowStepTemplate } from "@/lib/types";

export interface TimelineRow {
  styleId: string;
  styleCode: string;
  styleName: string | null;
  customerId: string;
  customerName: string;
  assigneeNames: string[];
  steps: WorkflowStepTemplate[];
  progressByStep: Map<string, StyleProgress>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface RowSummary {
  orderedSteps: WorkflowStepTemplate[];
  currentStep: WorkflowStepTemplate | null;
  currentProgress: StyleProgress | undefined;
  completionPct: number;
  isFullyDone: boolean;
}

function summarize(row: TimelineRow): RowSummary {
  const orderedSteps = [...row.steps].sort((a, b) => a.sort_order - b.sort_order);
  let doneCount = 0;
  let currentStep: WorkflowStepTemplate | null = null;
  let currentProgress: StyleProgress | undefined;

  for (const step of orderedSteps) {
    const p = row.progressByStep.get(step.id);
    if (p?.is_completed) {
      doneCount++;
      continue;
    }
    if (!currentStep) {
      currentStep = step;
      currentProgress = p;
    }
  }

  const total = orderedSteps.length;
  return {
    orderedSteps,
    currentStep,
    currentProgress,
    completionPct: total ? Math.round((doneCount / total) * 100) : 0,
    isFullyDone: total > 0 && doneCount === total,
  };
}

/** Ưu tiên hiển thị mã hàng gấp nhất lên đầu: quá hạn > nguy cơ trễ > đang thực hiện > chưa bắt đầu > đã xong. */
function urgencyRank(summary: RowSummary): number {
  if (summary.isFullyDone) return 4;
  if (!summary.currentProgress) return 3;
  const status = computeStatus(summary.currentProgress);
  if (status === "overdue") return 0;
  if (status === "at_risk") return 1;
  if (status === "in_progress") return 2;
  return 3;
}

export function MultiStyleTimeline({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) {
    return <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>Không có mã hàng nào.</div>;
  }

  const dates: number[] = [Date.now()];
  for (const r of rows) {
    for (const p of r.progressByStep.values()) {
      if (p.deadline_date) dates.push(new Date(p.deadline_date).getTime());
    }
  }
  const rawMin = Math.min(...dates);
  const rawMax = Math.max(...dates);
  const pad = Math.max((rawMax - rawMin) * 0.08, 3 * DAY_MS);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 1);
  const pct = (t: number) => ((t - min) / span) * 100;
  const today = Date.now();

  const withSummary = rows
    .map((row) => ({ row, summary: summarize(row) }))
    .sort((a, b) => urgencyRank(a.summary) - urgencyRank(b.summary));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {withSummary.map(({ row, summary }) => {
        const { currentStep, currentProgress, completionPct, isFullyDone } = summary;
        const status = isFullyDone ? "done_on_time" : currentProgress ? computeStatus(currentProgress) : "not_started";
        const barColor = isFullyDone ? "var(--color-green)" : STATUS_COLOR[status];

        return (
          <Link key={row.styleId} to={`/styles/${row.styleId}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13.5 }}>
                    {row.styleCode}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>
                    {row.customerName}
                    {row.styleName ? ` · ${row.styleName}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-text-3)", marginTop: 2 }}>
                    Phụ trách: {row.assigneeNames.length > 0 ? row.assigneeNames.join(", ") : "Chưa phân công"}
                  </div>
                </div>

                <div style={{ minWidth: 150 }}>
                  <div className="kpi-label">Giai đoạn hiện tại</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {isFullyDone ? "Hoàn thành toàn bộ" : currentStep?.name ?? "—"}
                  </div>
                  {!isFullyDone && currentProgress?.deadline_date && (
                    <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                      Deadline {formatDateVi(currentProgress.deadline_date)}
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 150 }}>
                  <div className="kpi-label">Trạng thái</div>
                  <span className={`badge ${isFullyDone ? "badge-green" : STATUS_BADGE_CLASS[status]}`}>
                    {isFullyDone ? "Hoàn thành" : STATUS_LABEL_VI[status]}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 140 }}>
                  <div className="kpi-label">Tiến độ</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="btrack" style={{ flex: 1 }}>
                      <div className="bfill" style={{ width: `${completionPct}%`, background: barColor }} />
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, width: 34, textAlign: "right" }}>
                      {completionPct}%
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ position: "relative", height: 18, marginTop: 12 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 2,
                    background: "var(--color-border)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${pct(today)}%`,
                    top: -3,
                    bottom: -3,
                    width: 1.5,
                    background: "var(--color-orange)",
                    opacity: 0.6,
                  }}
                />
                {summary.orderedSteps.map((s) => {
                  const p = row.progressByStep.get(s.id);
                  if (!p?.deadline_date) return null;
                  const color = STATUS_COLOR[computeStatus(p)];
                  return (
                    <div
                      key={s.id}
                      title={`${s.name} — ${formatDateVi(p.deadline_date)}`}
                      style={{
                        position: "absolute",
                        left: `${pct(new Date(p.deadline_date).getTime())}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        background: color,
                        border: "2px solid #fff",
                        boxShadow: "0 0 0 1px " + color,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
