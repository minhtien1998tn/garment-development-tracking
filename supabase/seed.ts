// Script seed dữ liệu mẫu — chạy 1 lần sau khi đã apply migrations trên project Supabase thật.
// Cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Project Settings > API) trong biến môi trường
// hoặc file .env.seed (KHÔNG commit file này — đã có trong .gitignore).
//
//   npm run seed
//
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.seed" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = "pdc.local";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong môi trường (xem .env.seed.example).");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function ensureEmployee(code: string, fullName: string, role: string, password: string) {
  const email = `${code.toLowerCase()}@${EMAIL_DOMAIN}`;
  const { data: existing } = await admin.from("employees").select("id").eq("employee_code", code).maybeSingle();
  if (existing) {
    console.log(`  = ${code} đã tồn tại, bỏ qua.`);
    return existing.id as string;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`Tạo auth user ${code} lỗi: ${error?.message}`);

  const { error: empErr } = await admin
    .from("employees")
    .insert({ id: created.user.id, employee_code: code, full_name: fullName, role, active: true });
  if (empErr) throw new Error(`Tạo employee ${code} lỗi: ${empErr.message}`);

  console.log(`  + ${code} (${role}) — mật khẩu: ${password}`);
  return created.user.id;
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("1. Tạo nhân viên mẫu...");
  await ensureEmployee("ADMIN01", "Nguyễn Văn Quản Trị", "admin", "Admin@123");
  const blId = await ensureEmployee("BL001", "Lê Văn Hùng", "brand_leader", "Brand@123");
  const empId1 = await ensureEmployee("NV001", "Trần Thị Mai", "employee", "Employee@123");
  const empId2 = await ensureEmployee("NV002", "Phạm Thị Lan", "employee", "Employee@123");

  console.log("2. Tạo khách hàng (brand) + mùa + bước công việc...");
  const customersData = [
    {
      code: "GAP",
      name: "GAP Inc.",
      seasons: ["Spring/Summer 2027", "Fall/Winter 2027"],
      steps: ["Proto 1", "Proto 2", "Proto 3", "SMS", "Sizeset", "PPS"],
    },
    {
      code: "UNQ",
      name: "Uniqlo",
      seasons: ["FW27"],
      steps: ["Proto", "Fit Sample", "Pre-Production", "Shipment Sample"],
    },
    {
      code: "HM",
      name: "H&M",
      seasons: ["SS27"],
      steps: ["Proto 1", "Proto 2", "SMS", "PPS"],
    },
  ];

  const customerIds: Record<string, string> = {};
  const seasonIds: Record<string, Record<string, string>> = {};
  const stepIds: Record<string, { id: string; name: string; sort_order: number }[]> = {};

  for (const c of customersData) {
    const { data: existingCustomer } = await admin.from("customers").select("*").eq("code", c.code).maybeSingle();
    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log(`  = ${c.code} đã tồn tại.`);
    } else {
      const { data, error } = await admin.from("customers").insert({ code: c.code, name: c.name }).select().single();
      if (error) throw new Error(error.message);
      customerId = data.id;
      console.log(`  + ${c.name}`);
    }
    customerIds[c.code] = customerId;
    seasonIds[c.code] = {};
    stepIds[c.code] = [];

    for (const seasonName of c.seasons) {
      const { data: existingSeason } = await admin
        .from("seasons")
        .select("id")
        .eq("customer_id", customerId)
        .eq("name", seasonName)
        .maybeSingle();
      if (existingSeason) {
        seasonIds[c.code][seasonName] = existingSeason.id;
        continue;
      }
      const { data, error } = await admin
        .from("seasons")
        .insert({ customer_id: customerId, name: seasonName })
        .select()
        .single();
      if (error) throw new Error(error.message);
      seasonIds[c.code][seasonName] = data.id;
    }

    for (let i = 0; i < c.steps.length; i++) {
      const stepName = c.steps[i];
      const { data: existingStep } = await admin
        .from("workflow_step_templates")
        .select("id, name, sort_order")
        .eq("customer_id", customerId)
        .eq("name", stepName)
        .maybeSingle();
      if (existingStep) {
        stepIds[c.code].push(existingStep);
        continue;
      }
      const { data, error } = await admin
        .from("workflow_step_templates")
        .insert({ customer_id: customerId, name: stepName, sort_order: i })
        .select()
        .single();
      if (error) throw new Error(error.message);
      stepIds[c.code].push(data);
    }
  }

  console.log("3. Gán Brand Leader + roster nhân viên theo brand...");
  await admin.from("customer_managers").upsert(
    { customer_id: customerIds["GAP"], employee_id: blId },
    { onConflict: "customer_id,employee_id" }
  );
  await admin.from("employee_brands").upsert(
    [
      { employee_id: blId, customer_id: customerIds["GAP"] },
      { employee_id: empId1, customer_id: customerIds["GAP"] },
      { employee_id: empId1, customer_id: customerIds["HM"] },
      { employee_id: empId2, customer_id: customerIds["UNQ"] },
    ],
    { onConflict: "employee_id,customer_id" }
  );

  console.log("4. Tạo mã hàng + phân công + tiến độ mẫu...");
  const ss27Gap = seasonIds["GAP"]["Spring/Summer 2027"];
  const fw27Unq = seasonIds["UNQ"]["FW27"];
  const ss27Hm = seasonIds["HM"]["SS27"];

  const stylesData = [
    { code: "GAP", seasonId: ss27Gap, styleCode: "GP-1001", styleName: "Áo thun nam", empIds: [empId1] },
    { code: "GAP", seasonId: ss27Gap, styleCode: "GP-1002", styleName: "Quần short nữ", empIds: [empId1, empId2] },
    { code: "UNQ", seasonId: fw27Unq, styleCode: "UQ-2001", styleName: "Áo khoác lông vũ", empIds: [empId2] },
    { code: "HM", seasonId: ss27Hm, styleCode: "HM-3001", styleName: "Váy hoa", empIds: [empId1] },
  ];

  for (const s of stylesData) {
    const customerId = customerIds[s.code];
    const { data: existingStyle } = await admin
      .from("styles")
      .select("id")
      .eq("customer_id", customerId)
      .eq("season_id", s.seasonId)
      .eq("style_code", s.styleCode)
      .maybeSingle();

    let styleId: string;
    if (existingStyle) {
      styleId = existingStyle.id;
    } else {
      const { data, error } = await admin
        .from("styles")
        .insert({ customer_id: customerId, season_id: s.seasonId, style_code: s.styleCode, style_name: s.styleName })
        .select()
        .single();
      if (error) throw new Error(error.message);
      styleId = data.id;

      await admin
        .from("style_assignments")
        .insert(s.empIds.map((employee_id) => ({ style_id: styleId, employee_id })));

      const steps = stepIds[s.code];
      // Trải trạng thái mẫu qua các bước: đã xong đúng hạn / trễ hạn / quá hạn / nguy cơ trễ / bình thường.
      const patterns = [
        { deadline: daysFromToday(-20), expected: null as string | null, completed: true, actual: daysFromToday(-21) },
        { deadline: daysFromToday(-10), expected: null as string | null, completed: true, actual: daysFromToday(-5) },
        { deadline: daysFromToday(-3), expected: daysFromToday(2), completed: false, actual: null },
        { deadline: daysFromToday(10), expected: daysFromToday(15), completed: false, actual: null },
        { deadline: daysFromToday(25), expected: daysFromToday(20), completed: false, actual: null },
        { deadline: daysFromToday(40), expected: null as string | null, completed: false, actual: null },
      ];

      await admin.from("style_progress").insert(
        steps.map((step, i) => {
          const p = patterns[i % patterns.length];
          return {
            style_id: styleId,
            step_template_id: step.id,
            deadline_date: p.deadline,
            expected_completion_date: p.expected,
            actual_completion_date: p.actual,
            is_completed: p.completed,
          };
        })
      );
    }
  }

  console.log("\nHoàn tất. Tài khoản đăng nhập mẫu:");
  console.log("  ADMIN01 / Admin@123      (Admin)");
  console.log("  BL001   / Brand@123      (Brand Leader — GAP)");
  console.log("  NV001   / Employee@123   (Employee)");
  console.log("  NV002   / Employee@123   (Employee)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
