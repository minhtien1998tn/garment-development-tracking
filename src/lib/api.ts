import { supabase } from "./supabaseClient";
import type {
  Customer,
  Employee,
  Season,
  Style,
  StyleAssignment,
  StyleProgress,
  WorkflowStepTemplate,
} from "./types";

function orThrow<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Khách hàng trong phạm vi người dùng hiện tại có thể thấy (RLS lọc sẵn ở DB). */
export async function listMyCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return orThrow(data, error);
}

export async function listAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("sort_order");
  return orThrow(data, error);
}

export async function listSeasons(customerId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("customer_id", customerId)
    .order("sort_order");
  return orThrow(data, error);
}

export async function listStepTemplates(customerId: string): Promise<WorkflowStepTemplate[]> {
  const { data, error } = await supabase
    .from("workflow_step_templates")
    .select("*")
    .eq("customer_id", customerId)
    .eq("active", true)
    .order("sort_order");
  return orThrow(data, error);
}

export async function listStylesForCustomer(
  customerId: string,
  seasonId?: string
): Promise<Style[]> {
  let query = supabase
    .from("styles")
    .select("*")
    .eq("customer_id", customerId)
    .eq("active", true);
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query.order("style_code");
  return orThrow(data, error);
}

export async function getStyle(styleId: string): Promise<Style> {
  const { data, error } = await supabase.from("styles").select("*").eq("id", styleId).single();
  return orThrow(data, error);
}

export async function listMyStyleIds(employeeId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("style_assignments")
    .select("style_id")
    .eq("employee_id", employeeId);
  return orThrow(data, error).map((r) => r.style_id as string);
}

export async function listAssignmentsForStyle(styleId: string): Promise<StyleAssignment[]> {
  const { data, error } = await supabase
    .from("style_assignments")
    .select("*")
    .eq("style_id", styleId);
  return orThrow(data, error);
}

export async function listProgressForStyle(styleId: string): Promise<StyleProgress[]> {
  const { data, error } = await supabase
    .from("style_progress")
    .select("*")
    .eq("style_id", styleId);
  return orThrow(data, error);
}

export async function listProgressForStyles(styleIds: string[]): Promise<StyleProgress[]> {
  if (styleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("style_progress")
    .select("*")
    .in("style_id", styleIds);
  return orThrow(data, error);
}

export async function upsertProgress(
  row: Partial<StyleProgress> & { style_id: string; step_template_id: string },
  updatedBy: string
): Promise<StyleProgress> {
  const payload = { ...row, updated_by: updatedBy, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("style_progress")
    .upsert(payload, { onConflict: "style_id,step_template_id" })
    .select()
    .single();
  return orThrow(data, error);
}

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("*").order("employee_code");
  return orThrow(data, error);
}

export async function listEmployeeBrands(customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("employee_brands")
    .select("employee_id")
    .eq("customer_id", customerId);
  return orThrow(data, error).map((r) => r.employee_id as string);
}

// ---------------------------------------------------------------------------
// Settings: Khai báo thông tin chung (khách hàng / mùa / bước công việc)
// ---------------------------------------------------------------------------

export async function createCustomer(code: string, name: string): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ code, name })
    .select()
    .single();
  return orThrow(data, error);
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase.from("customers").update(patch).eq("id", id).select().single();
  return orThrow(data, error);
}

export async function createSeason(customerId: string, name: string): Promise<Season> {
  const { data, error } = await supabase
    .from("seasons")
    .insert({ customer_id: customerId, name })
    .select()
    .single();
  return orThrow(data, error);
}

export async function updateSeason(id: string, patch: Partial<Season>): Promise<Season> {
  const { data, error } = await supabase.from("seasons").update(patch).eq("id", id).select().single();
  return orThrow(data, error);
}

/** Bao gồm cả bước đã ẩn (active=false) — dùng cho màn hình Cài đặt, khác với listStepTemplates(). */
export async function listStepTemplatesAll(customerId: string): Promise<WorkflowStepTemplate[]> {
  const { data, error } = await supabase
    .from("workflow_step_templates")
    .select("*")
    .eq("customer_id", customerId)
    .order("sort_order");
  return orThrow(data, error);
}

export async function createStepTemplate(
  customerId: string,
  name: string,
  sortOrder: number
): Promise<WorkflowStepTemplate> {
  const { data, error } = await supabase
    .from("workflow_step_templates")
    .insert({ customer_id: customerId, name, sort_order: sortOrder })
    .select()
    .single();
  const step = orThrow(data, error);

  // Tự tạo StyleProgress rỗng cho mọi mã hàng hiện có của khách hàng này.
  const styles = await listStylesForCustomer(customerId);
  if (styles.length > 0) {
    await supabase.from("style_progress").insert(
      styles.map((s) => ({ style_id: s.id, step_template_id: step.id }))
    );
  }
  return step;
}

export async function updateStepTemplate(
  id: string,
  patch: Partial<WorkflowStepTemplate>
): Promise<WorkflowStepTemplate> {
  const { data, error } = await supabase
    .from("workflow_step_templates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  return orThrow(data, error);
}

export async function reorderStepTemplates(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from("workflow_step_templates")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Settings: Sơ đồ tổ chức (nhân viên / role / phạm vi brand leader / brand)
// ---------------------------------------------------------------------------

export async function updateEmployee(id: string, patch: Partial<Employee>): Promise<Employee> {
  const { data, error } = await supabase.from("employees").update(patch).eq("id", id).select().single();
  return orThrow(data, error);
}

export async function listCustomerManagerIds(employeeId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("customer_managers")
    .select("customer_id")
    .eq("employee_id", employeeId);
  return orThrow(data, error).map((r) => r.customer_id as string);
}

/** Ghi đè toàn bộ phạm vi Brand Leader cho 1 nhân viên (chỉ Admin gọi được — RLS chặn brand_leader). */
export async function setCustomerManagerScope(employeeId: string, customerIds: string[]): Promise<void> {
  const { error: delErr } = await supabase.from("customer_managers").delete().eq("employee_id", employeeId);
  if (delErr) throw new Error(delErr.message);
  if (customerIds.length === 0) return;
  const { error: insErr } = await supabase
    .from("customer_managers")
    .insert(customerIds.map((customer_id) => ({ employee_id: employeeId, customer_id })));
  if (insErr) throw new Error(insErr.message);
}

export async function listAllEmployeeBrandRows(): Promise<{ employee_id: string; customer_id: string }[]> {
  const { data, error } = await supabase.from("employee_brands").select("employee_id, customer_id");
  return orThrow(data, error) as { employee_id: string; customer_id: string }[];
}

export async function listAllCustomerManagerRows(): Promise<{ employee_id: string; customer_id: string }[]> {
  const { data, error } = await supabase.from("customer_managers").select("employee_id, customer_id");
  return orThrow(data, error) as { employee_id: string; customer_id: string }[];
}

export async function listEmployeeBrandIds(employeeId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("employee_brands")
    .select("customer_id")
    .eq("employee_id", employeeId);
  return orThrow(data, error).map((r) => r.customer_id as string);
}

export async function setEmployeeBrandScope(employeeId: string, customerIds: string[]): Promise<void> {
  const { error: delErr } = await supabase.from("employee_brands").delete().eq("employee_id", employeeId);
  if (delErr) throw new Error(delErr.message);
  if (customerIds.length === 0) return;
  const { error: insErr } = await supabase
    .from("employee_brands")
    .insert(customerIds.map((customer_id) => ({ employee_id: employeeId, customer_id })));
  if (insErr) throw new Error(insErr.message);
}

// ---------------------------------------------------------------------------
// Settings: Mã hàng + phân công (lưới kiểu Excel)
// ---------------------------------------------------------------------------

export interface StyleGridRow {
  id?: string;
  styleCode: string;
  styleName: string;
  employeeCodes: string[];
}

export interface BulkSaveWarning {
  styleCode: string;
  message: string;
}

export async function bulkSaveStyles(
  customerId: string,
  seasonId: string,
  rows: StyleGridRow[],
  validEmployeeCodes: Map<string, string>
): Promise<{ warnings: BulkSaveWarning[] }> {
  const warnings: BulkSaveWarning[] = [];
  const steps = await listStepTemplates(customerId);

  for (const row of rows) {
    const styleCode = row.styleCode.trim();
    if (!styleCode) continue;

    const { data: existing } = await supabase
      .from("styles")
      .select("*")
      .eq("customer_id", customerId)
      .eq("season_id", seasonId)
      .eq("style_code", styleCode)
      .maybeSingle<Style>();

    let style: Style;
    if (existing) {
      const { data, error } = await supabase
        .from("styles")
        .update({ style_name: row.styleName || null })
        .eq("id", existing.id)
        .select()
        .single();
      style = orThrow(data, error);
    } else {
      const { data, error } = await supabase
        .from("styles")
        .insert({
          customer_id: customerId,
          season_id: seasonId,
          style_code: styleCode,
          style_name: row.styleName || null,
        })
        .select()
        .single();
      style = orThrow(data, error);

      if (steps.length > 0) {
        await supabase
          .from("style_progress")
          .insert(steps.map((s) => ({ style_id: style.id, step_template_id: s.id })));
      }
    }

    const employeeIds: string[] = [];
    for (const code of row.employeeCodes) {
      const trimmed = code.trim();
      if (!trimmed) continue;
      const empId = validEmployeeCodes.get(trimmed.toLowerCase());
      if (!empId) {
        warnings.push({ styleCode, message: `Mã NV "${trimmed}" không hợp lệ hoặc chưa thuộc brand này.` });
        continue;
      }
      employeeIds.push(empId);
    }

    const { data: currentAssignments } = await supabase
      .from("style_assignments")
      .select("id, employee_id")
      .eq("style_id", style.id);

    const current = new Set((currentAssignments ?? []).map((a) => a.employee_id as string));
    const target = new Set(employeeIds);

    const toRemove = (currentAssignments ?? []).filter((a) => !target.has(a.employee_id as string));
    if (toRemove.length > 0) {
      await supabase
        .from("style_assignments")
        .delete()
        .in("id", toRemove.map((a) => a.id as string));
    }

    const toAdd = [...target].filter((id) => !current.has(id));
    if (toAdd.length > 0) {
      await supabase
        .from("style_assignments")
        .insert(toAdd.map((employee_id) => ({ style_id: style.id, employee_id })));
    }
  }

  return { warnings };
}
