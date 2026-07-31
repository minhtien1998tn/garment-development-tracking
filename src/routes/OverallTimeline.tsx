import { useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { MultiStyleTimeline, type TimelineRow } from "@/components/MultiStyleTimeline";
import { useAuth } from "@/lib/AuthContext";
import { listMyCustomers, listStylesForCustomer, listStepTemplates, listProgressForStyles } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

export function OverallTimeline() {
  const { employee } = useAuth();
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setLoading(true);
      const customers = await listMyCustomers();
      const built: TimelineRow[] = [];

      for (const c of customers) {
        let styles = await listStylesForCustomer(c.id);
        if (employee.role === "employee") {
          const { data } = await supabase
            .from("style_assignments")
            .select("style_id")
            .eq("employee_id", employee.id);
          const myIds = new Set((data ?? []).map((r) => r.style_id as string));
          styles = styles.filter((s) => myIds.has(s.id));
        }
        if (styles.length === 0) continue;

        const steps = await listStepTemplates(c.id);
        const progress = await listProgressForStyles(styles.map((s) => s.id));
        const byStyle = new Map<string, typeof progress>();
        for (const p of progress) {
          const arr = byStyle.get(p.style_id) ?? [];
          arr.push(p);
          byStyle.set(p.style_id, arr);
        }

        for (const s of styles) {
          built.push({
            styleId: s.id,
            label: s.style_code,
            sublabel: `${c.name}${s.style_name ? " · " + s.style_name : ""}`,
            steps,
            progressByStep: new Map((byStyle.get(s.id) ?? []).map((p) => [p.step_template_id, p])),
          });
        }
      }
      setRows(built);
      setLoading(false);
    })();
  }, [employee]);

  return (
    <>
      <Topbar title="Tổng tiến độ toàn bộ mã hàng" />
      <div className="content">
        <div className="card">
          <div className="card-header">Timeline theo mã hàng (deadline từng bước)</div>
          <div style={{ padding: 16 }}>
            {loading ? <div>Đang tải...</div> : <MultiStyleTimeline rows={rows} />}
          </div>
        </div>
      </div>
    </>
  );
}
