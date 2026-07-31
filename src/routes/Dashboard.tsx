import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Topbar } from "@/components/Topbar";
import { KpiCard } from "@/components/KpiCard";
import { useAuth } from "@/lib/AuthContext";
import { listMyCustomers, listStylesForCustomer, listProgressForStyles, listEmployees } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { computeStatus, STATUS_COLOR } from "@/lib/status";
import type { ProgressStatus, StyleProgress } from "@/lib/types";

Chart.register(ArcElement, Tooltip, Legend);

interface EmployeeStat {
  employeeId: string;
  name: string;
  code: string;
  total: number;
  done: number;
  overdue: number;
}

export function Dashboard() {
  const { employee } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allProgress, setAllProgress] = useState<StyleProgress[]>([]);
  const [empStats, setEmpStats] = useState<EmployeeStat[]>([]);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setLoading(true);
      const customers = await listMyCustomers();
      const employees = await listEmployees();
      const empById = new Map(employees.map((e) => [e.id, e]));

      const statByEmp = new Map<string, EmployeeStat>();
      const progressAll: StyleProgress[] = [];

      for (const c of customers) {
        const styles = await listStylesForCustomer(c.id);
        if (styles.length === 0) continue;

        const { data: assignments } = await supabase
          .from("style_assignments")
          .select("style_id, employee_id")
          .in(
            "style_id",
            styles.map((s) => s.id)
          );

        const empByStyle = new Map<string, string[]>();
        for (const a of assignments ?? []) {
          const arr = empByStyle.get(a.style_id as string) ?? [];
          arr.push(a.employee_id as string);
          empByStyle.set(a.style_id as string, arr);
        }

        let scopedStyles = styles;
        if (employee.role === "employee") {
          scopedStyles = styles.filter((s) => (empByStyle.get(s.id) ?? []).includes(employee.id));
        }

        const progress = await listProgressForStyles(scopedStyles.map((s) => s.id));
        progressAll.push(...progress);

        const progressByStyle = new Map<string, StyleProgress[]>();
        for (const p of progress) {
          const arr = progressByStyle.get(p.style_id) ?? [];
          arr.push(p);
          progressByStyle.set(p.style_id, arr);
        }

        for (const s of scopedStyles) {
          const empIds = empByStyle.get(s.id) ?? [];
          const rows = progressByStyle.get(s.id) ?? [];
          for (const empId of empIds) {
            const emp = empById.get(empId);
            if (!emp || !emp.active) continue;
            const stat = statByEmp.get(empId) ?? {
              employeeId: empId,
              name: emp.full_name,
              code: emp.employee_code,
              total: 0,
              done: 0,
              overdue: 0,
            };
            for (const r of rows) {
              const st = computeStatus(r);
              stat.total++;
              if (st === "done_on_time" || st === "done_late") stat.done++;
              if (st === "overdue") stat.overdue++;
            }
            statByEmp.set(empId, stat);
          }
        }
      }

      setAllProgress(progressAll);
      setEmpStats(
        Array.from(statByEmp.values()).sort(
          (a, b) => b.done / (b.total || 1) - a.done / (a.total || 1)
        )
      );
      setLoading(false);
    })();
  }, [employee]);

  const statusCounts: Record<ProgressStatus, number> = {
    done_on_time: 0,
    done_late: 0,
    overdue: 0,
    at_risk: 0,
    in_progress: 0,
    not_started: 0,
  };
  for (const p of allProgress) statusCounts[computeStatus(p)]++;

  const totalTasks = allProgress.length;
  const doneTasks = statusCounts.done_on_time + statusCounts.done_late;
  const completionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <>
      <Topbar title="Dashboard báo cáo" />
      <div className="content">
        {loading ? (
          <div>Đang tải...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KpiCard label="Tổng số task" value={totalTasks} />
              <KpiCard label="Đã hoàn thành" value={doneTasks} accent="var(--color-green)" />
              <KpiCard label="% Hoàn thành" value={`${completionPct}%`} accent="var(--color-blue)" />
              <KpiCard label="Quá hạn" value={statusCounts.overdue} accent="var(--color-rose)" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
              <div className="card">
                <div className="card-header">Phân bố trạng thái</div>
                <div style={{ padding: 16 }}>
                  <Doughnut
                    data={{
                      labels: [
                        "Đúng hạn",
                        "Trễ hạn",
                        "Quá hạn",
                        "Nguy cơ trễ",
                        "Đang thực hiện",
                        "Chưa bắt đầu",
                      ],
                      datasets: [
                        {
                          data: [
                            statusCounts.done_on_time,
                            statusCounts.done_late,
                            statusCounts.overdue,
                            statusCounts.at_risk,
                            statusCounts.in_progress,
                            statusCounts.not_started,
                          ],
                          backgroundColor: [
                            STATUS_COLOR.done_on_time,
                            STATUS_COLOR.done_late,
                            STATUS_COLOR.overdue,
                            STATUS_COLOR.at_risk,
                            STATUS_COLOR.in_progress,
                            STATUS_COLOR.not_started,
                          ],
                        },
                      ],
                    }}
                    options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10.5 } } } } }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header">Xếp hạng theo nhân viên</div>
                <div style={{ padding: 16 }}>
                  {empStats.length === 0 && (
                    <div style={{ color: "var(--color-text-3)" }}>Chưa có dữ liệu.</div>
                  )}
                  {empStats.map((s) => {
                    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                    const color = pct >= 85 ? "var(--color-green)" : pct >= 50 ? "var(--color-amber)" : "var(--color-rose)";
                    return (
                      <div key={s.employeeId} className="brow">
                        <div className="blbl">
                          {s.name}
                          {s.overdue > 0 && (
                            <span className="badge badge-rose" style={{ marginLeft: 6 }}>
                              {s.overdue}
                            </span>
                          )}
                        </div>
                        <div className="btrack">
                          <div className="bfill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="bval">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
