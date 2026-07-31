# PDC Tracker — Quản lý tiến độ phát triển sản phẩm

Web app nội bộ cho bộ phận Product Development của công ty may FOB: nhân viên đăng nhập
bằng mã số + mật khẩu, theo dõi tiến độ mã hàng qua các bước công việc (Proto1/2/3, SMS,
Sizeset, PPS...) theo deadline; quản lý (Admin/Brand Leader) cấu hình khách hàng/mùa/bước
công việc, phân công, xem báo cáo tổng hợp.

Giao diện lấy cảm hứng từ `PDC_CanDoi_Demand_2026.html` (dashboard nội bộ cùng công ty).

## Stack

- **Frontend:** React + Vite + TypeScript (SPA thuần, không SSR) + react-router + Chart.js.
- **Backend:** Supabase (Postgres + Auth + Row Level Security + 2 Edge Function).
- **Hosting:** build tĩnh (`dist/`) upload lên Hostinger; Supabase host riêng (không liên quan
  Hostinger) đóng vai trò backend/API.

## 1. Cài đặt local

```bash
npm install
cp .env.example .env   # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

## 2. Tạo project Supabase

1. Tạo project mới tại [supabase.com](https://supabase.com/dashboard) (free tier đủ dùng).
2. Vào **SQL Editor**, chạy lần lượt 2 file trong `supabase/migrations/` theo đúng thứ tự:
   - `20260731000001_schema.sql`
   - `20260731000002_rls.sql`
3. Vào **Project Settings > API**, copy `Project URL` và `anon public key` vào `.env`.
4. Deploy 2 Edge Function (cần [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase functions deploy create-employee
   supabase functions deploy admin-reset-password
   ```
   (Edge Function tự có quyền dùng `SUPABASE_SERVICE_ROLE_KEY` — Supabase tự inject biến này,
   không cần khai báo thủ công.)
5. Tạo dữ liệu mẫu (tài khoản đăng nhập thử + vài khách hàng/mã hàng):
   ```bash
   cp .env.seed.example .env.seed   # điền SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (khác anon key!)
   npm run seed
   ```
   Script in ra danh sách mã NV/mật khẩu mẫu sau khi chạy xong.

**Lưu ý bảo mật:** `SUPABASE_SERVICE_ROLE_KEY` có toàn quyền, bỏ qua RLS — chỉ dùng ở máy cá
nhân khi chạy seed, tuyệt đối không đưa vào `.env` (frontend) hay commit lên Git.

## 3. Build & host lên Hostinger

```bash
npm run build
```

Upload toàn bộ nội dung thư mục `dist/` (bao gồm `.htaccess` đã có sẵn để SPA routing hoạt
động khi refresh trang con) lên `public_html` (hoặc thư mục subdomain) qua File Manager/FTP
của Hostinger. Không cần Node.js phía Hostinger — đây là site tĩnh gọi thẳng Supabase qua
REST API từ trình duyệt.

## 4. Publish code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <URL repo GitHub>
git push -u origin main
```

`.env` / `.env.seed` đã nằm trong `.gitignore` — không bị đẩy lên GitHub. `VITE_SUPABASE_ANON_KEY`
an toàn khi public vì mọi quyền truy cập dữ liệu đều được Row Level Security ở Postgres kiểm
soát theo `auth.uid()`, không dựa vào việc giấu khoá này.

## Cấu trúc thư mục

```
src/
  lib/        auth (AuthContext), truy vấn Supabase (api.ts), logic trạng thái (status.ts)
  components/ Sidebar, Topbar, ProgressMatrix, TimelineChart, MultiStyleTimeline...
  routes/     Login, Home, CustomerStyles, StyleProgress, OverallTimeline, Dashboard,
              settings/ (GeneralInfo, OrgChart, StylesAssignmentGrid)
supabase/
  migrations/ schema.sql + rls.sql
  functions/  create-employee, admin-reset-password (Edge Functions)
  seed.ts     script tạo dữ liệu mẫu
```

## 3 cấp quyền

| Role | Mô tả |
|---|---|
| `admin` | Toàn quyền: mọi khách hàng, cấu hình, nhân viên, cấp quyền. |
| `brand_leader` | Như admin nhưng giới hạn trong khách hàng (brand) được giao (`customer_managers`) — phân công việc, sửa deadline/bước công việc, **tự thêm nhân viên mới** (luôn ở role `employee`, tự gán vào brand của mình). |
| `employee` | Chỉ thấy/cập nhật mã hàng được giao (`style_assignments`) — không sửa deadline, không vào Cài đặt chung. |
