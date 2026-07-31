import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/AuthContext";
import {
  listSeasons,
  listStylesForCustomer,
  listProgressForStyles,
  listAllCustomers,
} from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { computeStatus } from "@/lib/status";
import type { Customer, Season, Style } from "@/lib/types";

interface StyleCard extends Style {
  completionPct: number;
}

export function CustomerStyles() {
  const { customerId } = useParams<{ customerId: string }>();
  const { employee } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      const all = await listAllCustomers();
      setCustomer(all.find((c) => c.id === customerId) ?? null);
      setSeasons(await listSeasons(customerId));
    })();
  }, [customerId]);

  useEffect(() => {
    if (!customerId || !employee) return;
    (async () => {
      setLoading(true);
      let list = await listStylesForCustomer(customerId, seasonId || undefined);

      if (employee.role === "employee") {
        const { data } = await supabase
          .from("style_assignments")
          .select("style_id")
          .eq("employee_id", employee.id);
        const myIds = new Set((data ?? []).map((r) => r.style_id as string));
        list = list.filter((s) => myIds.has(s.id));
      }

      const progress = await listProgressForStyles(list.map((s) => s.id));
      const byStyle = new Map<string, typeof progress>();
      for (const p of progress) {
        const arr = byStyle.get(p.style_id) ?? [];
        arr.push(p);
        byStyle.set(p.style_id, arr);
      }

      setStyles(
        list.map((s) => {
          const rows = byStyle.get(s.id) ?? [];
          const done = rows.filter((r) => {
            const st = computeStatus(r);
            return st === "done_on_time" || st === "done_late";
          }).length;
          return { ...s, completionPct: rows.length ? Math.round((done / rows.length) * 100) : 0 };
        })
      );
      setLoading(false);
    })();
  }, [customerId, seasonId, employee]);

  return (
    <>
      <Topbar title={customer ? `${customer.name} — Mã hàng` : "Mã hàng"} />
      <div className="content">
        {seasons.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                border: "1px solid var(--color-border)",
                fontSize: 13,
              }}
            >
              <option value="">Tất cả mùa</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {loading && <div style={{ color: "var(--color-text-3)" }}>Đang tải...</div>}
          {!loading && styles.length === 0 && (
            <div style={{ color: "var(--color-text-3)" }}>Không có mã hàng nào.</div>
          )}
          {styles.map((s) => (
            <Link key={s.id} to={`/styles/${s.id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: 14, color: "var(--color-text-1)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13 }}>
                  {s.style_code}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 2 }}>
                  {s.style_name ?? "—"}
                </div>
                <div className="btrack" style={{ marginTop: 10 }}>
                  <div className="bfill" style={{ width: `${s.completionPct}%` }} />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text-3)",
                    marginTop: 4,
                  }}
                >
                  {s.completionPct}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
