import { supabase } from "./supabaseClient";
import type { Role } from "./types";

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

/**
 * Tạo nhân viên mới (mã NV + mật khẩu). Admin: có thể set role bất kỳ + không bắt buộc brand.
 * Brand Leader: server luôn ép role="employee" và gán vào brand của người gọi, bỏ qua tham số
 * role/customerId phía client nếu có gửi khác đi (double-checked trong function).
 */
export async function createEmployee(input: {
  employeeCode: string;
  fullName: string;
  password: string;
  role?: Role;
  brandCustomerIds?: string[];
}): Promise<{ id: string }> {
  return invoke("create-employee", input);
}

export async function adminResetPassword(input: {
  employeeId: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  return invoke("admin-reset-password", input);
}
