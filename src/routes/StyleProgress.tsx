import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Topbar } from "@/components/Topbar";
import { TimelineChart } from "@/components/TimelineChart";
import { ProgressMatrix } from "@/components/ProgressMatrix";
import { useAuth } from "@/lib/AuthContext";
import {
  getStyle,
  listPhases,
  listStepTemplates,
  listProgressForStyle,
  upsertProgress,
  orderStepsByPhase,
} from "@/lib/api";
import { todayInputValue } from "@/lib/date";
import type { Style, StyleProgress as StyleProgressRow, WorkflowPhase, WorkflowStepTemplate } from "@/lib/types";

export function StyleProgress() {
  const { styleId } = useParams<{ styleId: string }>();
  const { employee, canManageCustomer } = useAuth();
  const [style, setStyle] = useState<Style | null>(null);
  const [phases, setPhases] = useState<WorkflowPhase[]>([]);
  const [steps, setSteps] = useState<WorkflowStepTemplate[]>([]);
  const [progressByStep, setProgressByStep] = useState<Map<string, StyleProgressRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!styleId) return;
    (async () => {
      setLoading(true);
      const s = await getStyle(styleId);
      setStyle(s);
      const [phaseList, stepList, progressList] = await Promise.all([
        listPhases(s.customer_id),
        listStepTemplates(s.customer_id),
        listProgressForStyle(styleId),
      ]);
      setPhases(phaseList);
      setSteps(orderStepsByPhase(phaseList, stepList));
      setProgressByStep(new Map(progressList.map((p) => [p.step_template_id, p])));
      setLoading(false);
    })();
  }, [styleId]);

  if (loading || !style || !employee) {
    return (
      <>
        <Topbar title="Tiến độ công việc" />
        <div className="content">Đang tải...</div>
      </>
    );
  }

  const canEditDeadline = canManageCustomer(style.customer_id);

  async function handleFieldChange(
    stepId: string,
    field: "deadline_date" | "expected_completion_date" | "is_completed" | "remark",
    value: string | boolean
  ) {
    if (!style || !employee) return;
    const existing = progressByStep.get(stepId);
    const patch: Partial<StyleProgressRow> = { [field]: value === "" ? null : value } as Partial<StyleProgressRow>;

    if (field === "is_completed") {
      patch.is_completed = value as boolean;
      patch.actual_completion_date = value ? todayInputValue() : null;
    }

    setSaving(true);
    try {
      const saved = await upsertProgress(
        {
          style_id: style.id,
          step_template_id: stepId,
          deadline_date: existing?.deadline_date ?? null,
          expected_completion_date: existing?.expected_completion_date ?? null,
          actual_completion_date: existing?.actual_completion_date ?? null,
          is_completed: existing?.is_completed ?? false,
          remark: existing?.remark ?? null,
          ...patch,
        },
        employee.id
      );
      setProgressByStep((prev) => new Map(prev).set(stepId, saved));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar title={`${style.style_code}${style.style_name ? " — " + style.style_name : ""}`} />
      <div className="content">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Timeline</span>
            {saving && <span style={{ color: "var(--color-orange)" }}>Đang lưu...</span>}
          </div>
          <TimelineChart steps={steps} progressByStep={progressByStep} />
        </div>

        <div className="card">
          <div className="card-header">Lưới tiến độ chi tiết</div>
          <div style={{ padding: 16 }}>
            <ProgressMatrix
              phases={phases}
              steps={steps}
              progressByStep={progressByStep}
              canEditDeadline={canEditDeadline}
              onFieldChange={handleFieldChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}
