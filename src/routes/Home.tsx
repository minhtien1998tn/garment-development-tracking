import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Topbar } from "@/components/Topbar";
import { KpiCard } from "@/components/KpiCard";
import { useAuth } from "@/lib/AuthContext";
import { listMyCustomers, listStylesForCustomer, listProgressForStyles } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { computeStatus } from "@/lib/status";
import type { Customer, Style } from "@/lib/types";

interface CustomerCard extends Customer {
  styleCount: number;
  completionPct: number;
  overdueCount: number;
}

export function Home() {
  const { employee } = useAuth();
  const [cards, setCards] = useState<CustomerCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setLoading(true);
      const customers = await listMyCustomers();
      const built: CustomerCard[] = [];

      for (const c of customers) {
        let styles: Style[] = await listStylesForCustomer(c.id);
        if (employee.role === "employee") {
          const { data } = await supabase
            .from("style_assignments")
            .select("style_id")
            .eq("employee_id", employee.id);
          const myIds = new Set((data ?? []).map((r) => r.style_id as string));
          styles = styles.filter((s) => myIds.has(s.id));
        }
        if (styles.length === 0) continue;

        const progress = await listProgressForStyles(styles.map((s) => s.id));
        let done = 0;
        let overdue = 0;
        for (const p of progress) {
          const status = computeStatus(p);
          if (status === "done_on_time" || status === "done_late") done++;
          if (status === "overdue") overdue++;
        }
        built.push({
          ...c,
          styleCount: styles.length,
          completionPct: progress.length ? Math.round((done / progress.length) * 100) : 0,
          overdueCount: overdue,
        });
      }
      setCards(built);
      setLoading(false);
    })();
  }, [employee]);

  return (
    <>
      <Topbar title="Khách hàng được phân công" />
      <div className="content">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {loading && <div style={{ color: "var(--color-text-3)" }}>Đang tải...</div>}
          {!loading && cards.length === 0 && (
            <div style={{ color: "var(--color-text-3)" }}>
              Chưa có khách hàng/mã hàng nào được phân công cho bạn.
            </div>
          )}
          {cards.map((c) => (
            <Link key={c.id} to={`/customers/${c.id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: 16, color: "var(--color-text-1)" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--color-text-3)",
                    textTransform: "uppercase",
                  }}
                >
                  {c.code}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--color-text-2)", marginTop: 6 }}>
                  {c.styleCount} mã hàng · {c.completionPct}% hoàn thành
                  {c.overdueCount > 0 && (
                    <span className="badge badge-rose" style={{ marginLeft: 6 }}>
                      {c.overdueCount} quá hạn
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && cards.length > 0 && (
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <KpiCard label="Khách hàng" value={cards.length} />
            <KpiCard label="Tổng mã hàng" value={cards.reduce((a, c) => a + c.styleCount, 0)} accent="var(--color-blue)" />
            <KpiCard
              label="Mã hàng quá hạn (task)"
              value={cards.reduce((a, c) => a + c.overdueCount, 0)}
              accent="var(--color-rose)"
            />
          </div>
        )}
      </div>
    </>
  );
}
