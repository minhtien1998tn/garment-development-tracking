import { formatDateVi } from "@/lib/date";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="live-dot" />
        <span
          className="badge badge-gray"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {formatDateVi(new Date().toISOString())}
        </span>
      </div>
    </header>
  );
}
