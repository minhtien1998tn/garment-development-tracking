// Script seed dữ liệu mẫu — chạy 1 lần sau khi đã apply migrations trên project Supabase thật.
// Không có tài khoản/mật khẩu (đã bỏ xác thực) — chỉ cần VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// trong file .env (dùng chung với app, vì bảng đã mở quyền cho anon).
//
//   npm run seed
//
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, ANON_KEY);

async function ensureEmployee(code: string, fullName: string, role: string) {
  const { data: existing } = await db.from("employees").select("id").eq("employee_code", code).maybeSingle();
  if (existing) {
    console.log(`  = ${code} đã tồn tại, bỏ qua.`);
    return existing.id as string;
  }

  const { data, error } = await db
    .from("employees")
    .insert({ employee_code: code, full_name: fullName, role, active: true })
    .select()
    .single();
  if (error) throw new Error(`Tạo employee ${code} lỗi: ${error.message}`);

  console.log(`  + ${code} (${role}) — ${fullName}`);
  return data.id as string;
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("1. Tạo nhân viên mẫu...");
  await ensureEmployee("ADMIN01", "Nguyễn Văn Quản Trị", "admin");
  const blId = await ensureEmployee("BL001", "Lê Văn Hùng", "brand_leader");
  const empId1 = await ensureEmployee("NV001", "Trần Thị Mai", "employee");
  const empId2 = await ensureEmployee("NV002", "Phạm Thị Lan", "employee");

  console.log("2. Tạo khách hàng (brand) + mùa + giai đoạn + bước công việc...");
  const customersData = [
    {
      code: "GAP",
      name: "GAP Inc.",
      seasons: ["Spring/Summer 2027", "Fall/Winter 2027"],
      phases: [
        { name: "Phát triển mẫu", steps: ["Proto 1", "Proto 2", "Proto 3"] },
        { name: "Duyệt mẫu & sản xuất thử", steps: ["SMS", "Sizeset", "PPS"] },
      ],
    },
    {
      code: "UNQ",
      name: "Uniqlo",
      seasons: ["FW27"],
      phases: [
        { name: "Phát triển mẫu", steps: ["Proto", "Fit Sample"] },
        { name: "Trước sản xuất", steps: ["Pre-Production", "Shipment Sample"] },
      ],
    },
    {
      code: "HM",
      name: "H&M",
      seasons: ["SS27"],
      phases: [
        { name: "Phát triển mẫu", steps: ["Proto 1", "Proto 2"] },
        { name: "Duyệt mẫu & sản xuất thử", steps: ["SMS", "PPS"] },
      ],
    },
  ];

  const customerIds: Record<string, string> = {};
  const seasonIds: Record<string, Record<string, string>> = {};
  const stepIds: Record<string, { id: string; name: string; sort_order: number }[]> = {};

  for (const c of customersData) {
    const { data: existingCustomer } = await db.from("customers").select("*").eq("code", c.code).maybeSingle();
    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log(`  = ${c.code} đã tồn tại.`);
    } else {
      const { data, error } = await db.from("customers").insert({ code: c.code, name: c.name }).select().single();
      if (error) throw new Error(error.message);
      customerId = data.id;
      console.log(`  + ${c.name}`);
    }
    customerIds[c.code] = customerId;
    seasonIds[c.code] = {};
    stepIds[c.code] = [];

    for (const seasonName of c.seasons) {
      const { data: existingSeason } = await db
        .from("seasons")
        .select("id")
        .eq("customer_id", customerId)
        .eq("name", seasonName)
        .maybeSingle();
      if (existingSeason) {
        seasonIds[c.code][seasonName] = existingSeason.id;
        continue;
      }
      const { data, error } = await db
        .from("seasons")
        .insert({ customer_id: customerId, name: seasonName })
        .select()
        .single();
      if (error) throw new Error(error.message);
      seasonIds[c.code][seasonName] = data.id;
    }

    for (let pi = 0; pi < c.phases.length; pi++) {
      const phase = c.phases[pi];
      let phaseId: string;
      const { data: existingPhase } = await db
        .from("workflow_phases")
        .select("id")
        .eq("customer_id", customerId)
        .eq("name", phase.name)
        .maybeSingle();
      if (existingPhase) {
        phaseId = existingPhase.id;
      } else {
        const { data, error } = await db
          .from("workflow_phases")
          .insert({ customer_id: customerId, name: phase.name, sort_order: pi })
          .select()
          .single();
        if (error) throw new Error(error.message);
        phaseId = data.id;
      }

      for (let si = 0; si < phase.steps.length; si++) {
        const stepName = phase.steps[si];
        const { data: existingStep } = await db
          .from("workflow_step_templates")
          .select("id, name, sort_order")
          .eq("customer_id", customerId)
          .eq("name", stepName)
          .maybeSingle();
        if (existingStep) {
          stepIds[c.code].push(existingStep);
          continue;
        }
        const { data, error } = await db
          .from("workflow_step_templates")
          .insert({ customer_id: customerId, phase_id: phaseId, name: stepName, sort_order: si })
          .select()
          .single();
        if (error) throw new Error(error.message);
        stepIds[c.code].push(data);
      }
    }
  }

  console.log("3. Gán Brand Leader + roster nhân viên theo brand...");
  await db.from("customer_managers").upsert(
    { customer_id: customerIds["GAP"], employee_id: blId },
    { onConflict: "customer_id,employee_id" }
  );
  await db.from("employee_brands").upsert(
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
    const { data: existingStyle } = await db
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
      const { data, error } = await db
        .from("styles")
        .insert({ customer_id: customerId, season_id: s.seasonId, style_code: s.styleCode, style_name: s.styleName })
        .select()
        .single();
      if (error) throw new Error(error.message);
      styleId = data.id;

      await db.from("style_assignments").insert(s.empIds.map((employee_id) => ({ style_id: styleId, employee_id })));

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

      await db.from("style_progress").insert(
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

  console.log("\nHoàn tất. Không cần mật khẩu — vào app, chọn khách hàng rồi chọn tên:");
  console.log("  Nguyễn Văn Quản Trị (ADMIN01) — Admin, thấy mọi khách hàng");
  console.log("  Lê Văn Hùng (BL001) — Brand Leader của GAP");
  console.log("  Trần Thị Mai (NV001), Phạm Thị Lan (NV002) — Employee");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
