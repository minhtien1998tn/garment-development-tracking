import { useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { KpiCard } from "@/components/KpiCard";
import { MultiStyleTimeline, type TimelineRow } from "@/components/MultiStyleTimeline";
import { useAuth } from "@/lib/AuthContext";
import {
  listMyCustomers,
  listStylesForCustomer,
  listStepTemplates,
  listProgressForStyles,
  listAssignmentsForStyles,
  listEmployees,
} from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { computeStatus } from "@/lib/status";
import type { Customer } from "@/lib/types";

export function OverallTimeline() {
  const { employee } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setLoading(true);
      const [myCustomers, employees] = await Promise.all([listMyCustomers(), listEmployees()]);
      setCustomers(myCustomers);
      const empNameById = new Map(employees.map((e) => [e.id, e.full_name]));
      const built: TimelineRow[] = [];

      for (const c of myCustomers) {
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

        const styleIds = styles.map((s) => s.id);
        const [steps, progress, assignments] = await Promise.all([
          listStepTemplates(c.id),
          listProgressForStyles(styleIds),
          listAssignmentsForStyles(styleIds),
        ]);

        const progressByStyle = new Map<string, typeof progress>();
        for (const p of progress) {
          const arr = progressByStyle.get(p.style_id) ?? [];
          arr.push(p);
          progressByStyle.set(p.style_id, arr);
        }

        const assigneesByStyle = new Map<string, string[]>();
        for (const a of assignments) {
          const arr = assigneesByStyle.get(a.style_id) ?? [];
          const name = empNameById.get(a.employee_id);
          if (name) arr.push(name);
          assigneesByStyle.set(a.style_id, arr);
        }

        for (const s of styles) {
          built.push({
            styleId: s.id,
            styleCode: s.style_code,
            styleName: s.style_name,
            customerId: c.id,
            customerName: c.name,
            assigneeNames: assigneesByStyle.get(s.id) ?? [],
            steps,
            progressByStep: new Map((progressByStyle.get(s.id) ?? []).map((p) => [p.step_template_id, p])),
          });
        }
      }
      setRows(built);
      setLoading(false);
    })();
  }, [employee]);

  const visibleRows = selectedCustomerId ? rows.filter((r) => r.customerId === selectedCustomerId) : rows;

  const overdueCount = visibleRows.filter((r) =>
    [...r.progressByStep.values()].some((p) => !p.is_completed && computeStatus(p) === "overdue")
  ).length;
  const atRiskCount = visibleRows.filter((r) =>
    [...r.progressByStep.values()].some((p) => !p.is_completed && computeStatus(p) === "at_risk")
  ).length;
  const doneCount = visibleRows.filter(
    (r) => r.steps.length > 0 && r.steps.every((s) => r.progressByStep.get(s.id)?.is_completed)
  ).length;

  return (
    <>
      <Topbar title="Tổng tiến độ toàn bộ mã hàng" />
      <div className="content">
        {customers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                border: "1px solid var(--color-border)",
                fontSize: 13,
              }}
            >
              <option value="">Tất cả khách hàng</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!loading && visibleRows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <KpiCard label="Tổng mã hàng" value={visibleRows.length} />
            <KpiCard label="Đã hoàn thành" value={doneCount} accent="var(--color-green)" />
            <KpiCard label="Nguy cơ trễ" value={atRiskCount} accent="var(--color-amber)" />
            <KpiCard label="Quá hạn" value={overdueCount} accent="var(--color-rose)" />
          </div>
        )}

        <div className="card">
          <div className="card-header">Chi tiết tiến độ theo mã hàng — bấm vào để xem chi tiết</div>
          <div style={{ padding: 16 }}>
            {loading ? <div>Đang tải...</div> : <MultiStyleTimeline rows={visibleRows} />}
          </div>
        </div>
      </div>
    </>
  );
}
