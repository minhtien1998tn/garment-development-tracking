import type { CSSProperties } from "react";

export function KpiCard({
  label,
  value,
  accent = "var(--color-orange)",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="kpi-card" style={{ "--kpi-accent": accent } as CSSProperties}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
