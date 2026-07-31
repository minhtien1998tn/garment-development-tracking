import { computeStatus, STATUS_COLOR } from "@/lib/status";
import { formatDateVi } from "@/lib/date";
import type { StyleProgress, WorkflowStepTemplate } from "@/lib/types";

interface Props {
  steps: WorkflowStepTemplate[];
  progressByStep: Map<string, StyleProgress>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function TimelineChart({ steps, progressByStep }: Props) {
  const dates: number[] = [Date.now()];
  for (const s of steps) {
    const p = progressByStep.get(s.id);
    if (p?.deadline_date) dates.push(new Date(p.deadline_date).getTime());
    if (p?.expected_completion_date) dates.push(new Date(p.expected_completion_date).getTime());
    if (p?.actual_completion_date) dates.push(new Date(p.actual_completion_date).getTime());
  }

  const rawMin = Math.min(...dates);
  const rawMax = Math.max(...dates);
  const pad = Math.max((rawMax - rawMin) * 0.12, 3 * DAY_MS);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 1);

  const pct = (t: number) => ((t - min) / span) * 100;
  const today = Date.now();

  if (steps.length === 0) {
    return (
      <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>
        Khách hàng này chưa cấu hình bước công việc.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 150, padding: "36px 20px 44px" }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: "50%",
          height: 2,
          background: "var(--color-border)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `calc(20px + ${pct(today)}% * (100% - 40px) / 100)`,
          top: 0,
          bottom: 0,
          width: 2,
          background: "var(--color-orange)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -18,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            fontWeight: 700,
            color: "var(--color-orange)",
            whiteSpace: "nowrap",
          }}
        >
          HÔM NAY
        </div>
      </div>

      {steps.map((step, i) => {
        const p = progressByStep.get(step.id);
        if (!p?.deadline_date) return null;
        const status = computeStatus(p);
        const color = STATUS_COLOR[status];
        const left = `calc(20px + ${pct(new Date(p.deadline_date).getTime())}% * (100% - 40px) / 100)`;
        const above = i % 2 === 0;

        return (
          <div key={step.id} style={{ position: "absolute", left, top: "50%", transform: "translate(-50%, -50%)" }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: color,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px " + color,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: `translate(-50%, ${above ? "-100%" : "0"})`,
                top: above ? -8 : 20,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700 }}>
                {step.name}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--color-text-3)" }}>
                {formatDateVi(p.deadline_date)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
