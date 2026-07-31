# Garment Development Tracking — Quản lý tiến độ phát triển sản phẩm

Web app nội bộ cho bộ phận Product Development của công ty may FOB: nhân viên vào app chọn
khách hàng rồi chọn tên mình trong danh sách (không tài khoản/mật khẩu), theo dõi tiến độ mã
hàng qua các bước công việc (Proto1/2/3, SMS, Sizeset, PPS...) theo deadline; quản lý
(Admin/Brand Leader) cấu hình khách hàng/mùa/bước công việc, phân công, xem báo cáo tổng hợp.

Giao diện lấy cảm hứng từ `PDC_CanDoi_Demand_2026.html` (dashboard nội bộ cùng công ty).

> **⚠️ Không có xác thực/bảo mật thực sự.** Đây là lựa chọn có chủ đích để tối giản: bất kỳ
> ai có link đều xem/sửa được toàn bộ dữ liệu (khách hàng, deadline, tiến độ...) và có thể
> "giả danh" bất kỳ nhân viên nào chỉ bằng cách chọn tên — phân quyền admin/brand_leader/
> employee chỉ còn là gợi ý giao diện, **không** được database enforce. Chỉ phù hợp nếu dữ
> liệu không nhạy cảm hoặc bạn chấp nhận rủi ro này khi host public.

## Stack

- **Frontend:** React + Vite + TypeScript (SPA thuần, không SSR) + react-router + Chart.js.
- **Backend:** Supabase (chỉ dùng Postgres làm nơi lưu dữ liệu — không dùng Auth, không RLS,
  không Edge Function).
- **Hosting:** build tĩnh (`dist/`) upload lên Hostinger; Supabase host riêng (không liên quan
  Hostinger) đóng vai trò database/API.

## 1. Cài đặt local

```bash
npm install
cp .env.example .env   # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

## 2. Tạo project Supabase

1. Tạo project mới tại [supabase.com](https://supabase.com/dashboard) (free tier đủ dùng).
2. Vào **SQL Editor**, chạy lần lượt 3 file trong `supabase/migrations/` theo đúng thứ tự:
   - `20260731000001_schema.sql` — tạo bảng
   - `20260731000002_rls.sql` — tạo hàm/luật phân quyền (lịch sử)
   - `20260731000003_remove_auth.sql` — gỡ ràng buộc tài khoản, tắt RLS, mở quyền cho `anon`
3. Vào **Project Settings > API**, copy `Project URL` và **Publishable/anon key** vào `.env`.
4. Tạo dữ liệu mẫu (vài nhân viên/khách hàng/mã hàng để thử — dùng chung `.env` ở trên, không
   cần key nào khác):
   ```bash
   npm run seed
   ```

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

`.env` đã nằm trong `.gitignore` — không bị đẩy lên GitHub (dù key này không có gì bí mật để
bảo vệ nữa, vì mọi bảng đều mở quyền công khai cho `anon`).

## Cấu trúc thư mục

```
src/
  lib/        "auth" (AuthContext — chỉ chọn nhân viên qua localStorage), truy vấn Supabase
              (api.ts), logic trạng thái (status.ts)
  components/ Sidebar, Topbar, ProgressMatrix, TimelineChart, MultiStyleTimeline...
  routes/     Login (màn hình chọn khách hàng → tên), Home, CustomerStyles, StyleProgress,
              OverallTimeline, Dashboard, settings/ (GeneralInfo, OrgChart, StylesAssignmentGrid)
supabase/
  migrations/ schema.sql + rls.sql (lịch sử) + remove_auth.sql (trạng thái hiện tại)
  seed.ts     script tạo dữ liệu mẫu
```

## 3 cấp quyền (chỉ ở giao diện, không được database enforce)

| Role | Mô tả |
|---|---|
| `admin` | Toàn quyền: mọi khách hàng, cấu hình, nhân viên. |
| `brand_leader` | Như admin nhưng giao diện giới hạn trong khách hàng (brand) được giao (`customer_managers`) — phân công việc, sửa deadline/bước công việc, **tự thêm nhân viên mới** (luôn ở role `employee`, tự gán vào brand của mình). |
| `employee` | Chỉ thấy/cập nhật mã hàng được giao (`style_assignments`) — không sửa deadline, không vào Cài đặt chung. |
