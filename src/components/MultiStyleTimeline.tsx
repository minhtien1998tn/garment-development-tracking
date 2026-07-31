import { computeStatus, STATUS_COLOR } from "@/lib/status";
import type { StyleProgress, WorkflowStepTemplate } from "@/lib/types";

export interface TimelineRow {
  styleId: string;
  label: string;
  sublabel: string;
  steps: WorkflowStepTemplate[];
  progressByStep: Map<string, StyleProgress>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function MultiStyleTimeline({ rows }: { rows: TimelineRow[] }) {
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

  if (rows.length === 0) {
    return <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>Không có mã hàng nào.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 720 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--color-text-3)",
            marginBottom: 6,
          }}
        >
          <div style={{ width: 200, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            {new Date(min).toLocaleDateString("vi-VN")} → {new Date(max).toLocaleDateString("vi-VN")}
          </div>
        </div>

        {rows.map((r) => (
          <div
            key={r.styleId}
            style={{
              display: "flex",
              alignItems: "center",
              borderTop: "1px solid var(--color-border)",
              padding: "10px 0",
            }}
          >
            <div style={{ width: 200, flexShrink: 0, paddingRight: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 12.5 }}>
                {r.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>{r.sublabel}</div>
            </div>

            <div style={{ position: "relative", flex: 1, height: 20 }}>
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
                  top: -4,
                  bottom: -4,
                  width: 1.5,
                  background: "var(--color-orange)",
                  opacity: 0.6,
                }}
              />
              {r.steps.map((s) => {
                const p = r.progressByStep.get(s.id);
                if (!p?.deadline_date) return null;
                const color = STATUS_COLOR[computeStatus(p)];
                return (
                  <div
                    key={s.id}
                    title={`${s.name} — ${new Date(p.deadline_date).toLocaleDateString("vi-VN")}`}
                    style={{
                      position: "absolute",
                      left: `${pct(new Date(p.deadline_date).getTime())}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 10,
                      height: 10,
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
        ))}
      </div>
    </div>
  );
}
