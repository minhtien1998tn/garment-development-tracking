// Supabase Edge Function: đặt lại mật khẩu cho nhân viên khác.
// Chỉ Admin, hoặc Brand Leader khi nhân viên mục tiêu thuộc brand họ quản trị.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  employeeId: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: callerUser },
  } = await callerClient.auth.getUser();
  if (!callerUser) {
    return new Response(JSON.stringify({ error: "Chưa đăng nhập." }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerEmployee } = await admin
    .from("employees")
    .select("id, role")
    .eq("id", callerUser.id)
    .single();

  if (!callerEmployee || (callerEmployee.role !== "admin" && callerEmployee.role !== "brand_leader")) {
    return new Response(JSON.stringify({ error: "Không có quyền đặt lại mật khẩu." }), { status: 403 });
  }

  const body = (await req.json()) as Body;
  if (!body.employeeId || !body.newPassword || body.newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "Mật khẩu phải từ 6 ký tự." }), { status: 400 });
  }

  if (callerEmployee.role === "brand_leader") {
    const { data: managedRows } = await admin
      .from("customer_managers")
      .select("customer_id")
      .eq("employee_id", callerEmployee.id);
    const managedIds = (managedRows ?? []).map((r) => r.customer_id as string);

    const { data: targetBrands } = await admin
      .from("employee_brands")
      .select("customer_id")
      .eq("employee_id", body.employeeId);
    const targetIds = (targetBrands ?? []).map((r) => r.customer_id as string);

    const overlap = targetIds.some((id) => managedIds.includes(id));
    if (!overlap) {
      return new Response(
        JSON.stringify({ error: "Nhân viên này không thuộc brand bạn quản trị." }),
        { status: 403 }
      );
    }
  }

  const { error } = await admin.auth.admin.updateUserById(body.employeeId, {
    password: body.newPassword,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
