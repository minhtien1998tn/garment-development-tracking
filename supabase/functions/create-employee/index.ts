// Supabase Edge Function: tạo nhân viên mới (mã NV + mật khẩu).
// Admin: có thể set role bất kỳ + brand bất kỳ.
// Brand Leader: server LUÔN ép role="employee" và brand=phạm vi quản trị của người gọi,
// bỏ qua role/brandCustomerIds mà client gửi lên nếu khác — tránh brand leader tự leo thang quyền.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMPLOYEE_EMAIL_DOMAIN = "pdc.local";

interface Body {
  employeeCode: string;
  fullName: string;
  password: string;
  role?: "admin" | "brand_leader" | "employee";
  brandCustomerIds?: string[];
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
    return new Response(JSON.stringify({ error: "Không có quyền tạo nhân viên." }), { status: 403 });
  }

  const body = (await req.json()) as Body;
  const employeeCode = body.employeeCode?.trim();
  const fullName = body.fullName?.trim();
  const password = body.password;

  if (!employeeCode || !fullName || !password || password.length < 6) {
    return new Response(
      JSON.stringify({ error: "Thiếu mã NV/họ tên, hoặc mật khẩu phải từ 6 ký tự." }),
      { status: 400 }
    );
  }

  let role: "admin" | "brand_leader" | "employee";
  let brandCustomerIds: string[];

  if (callerEmployee.role === "admin") {
    role = body.role ?? "employee";
    brandCustomerIds = body.brandCustomerIds ?? [];
  } else {
    // brand_leader: ép cứng, không tin dữ liệu client gửi lên.
    const { data: managedRows } = await admin
      .from("customer_managers")
      .select("customer_id")
      .eq("employee_id", callerEmployee.id);
    role = "employee";
    brandCustomerIds = (managedRows ?? []).map((r) => r.customer_id as string);
    if (brandCustomerIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Bạn chưa được giao quản trị brand nào." }),
        { status: 403 }
      );
    }
  }

  const email = `${employeeCode.toLowerCase()}@${EMPLOYEE_EMAIL_DOMAIN}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    return new Response(
      JSON.stringify({ error: createErr?.message ?? "Không tạo được tài khoản (mã NV có thể đã tồn tại)." }),
      { status: 400 }
    );
  }

  const { error: empErr } = await admin.from("employees").insert({
    id: created.user.id,
    employee_code: employeeCode,
    full_name: fullName,
    role,
    active: true,
  });

  if (empErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return new Response(JSON.stringify({ error: empErr.message }), { status: 400 });
  }

  if (brandCustomerIds.length > 0) {
    await admin
      .from("employee_brands")
      .insert(brandCustomerIds.map((customer_id) => ({ employee_id: created.user.id, customer_id })));
  }

  return new Response(JSON.stringify({ id: created.user.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
