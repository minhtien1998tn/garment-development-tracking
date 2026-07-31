-- Bỏ hoàn toàn xác thực (Supabase Auth): đăng nhập nay chỉ là chọn khách hàng rồi chọn tên
-- nhân viên trong danh sách, không mật khẩu, không tài khoản. Quyết định có chủ đích của
-- người dùng dù đã được cảnh báo rủi ro: mọi người có link đều xem/sửa được toàn bộ dữ liệu
-- và có thể "giả danh" bất kỳ nhân viên nào — phân quyền admin/brand_leader/employee từ đây
-- chỉ còn là gợi ý giao diện (UI), không còn được database thực thi bắt buộc.

-- 1) employees không còn gắn với auth.users nữa — id tự sinh như mọi bảng khác.
alter table employees drop constraint if exists employees_id_fkey;
alter table employees alter column id set default gen_random_uuid();

-- 2) Gỡ các trigger/hàm dựa trên auth.uid() — không còn ý nghĩa vì không còn phiên đăng nhập.
drop trigger if exists trg_enforce_employee_update on employees;
drop function if exists enforce_employee_update();

drop trigger if exists trg_enforce_style_progress_update on style_progress;
drop function if exists enforce_style_progress_update();

-- Giữ lại đúng 1 phần thuần nghiệp vụ (không liên quan auth) của trigger cũ: tick hoàn thành
-- thì tự set ngày hoàn thành thực tế; bỏ tick thì xoá ngày đó.
create or replace function set_actual_completion_date() returns trigger
language plpgsql as $$
begin
  if new.is_completed then
    if new.actual_completion_date is null then
      new.actual_completion_date := current_date;
    end if;
  else
    new.actual_completion_date := null;
  end if;
  return new;
end;
$$;

create trigger trg_set_actual_completion_date
  before update on style_progress
  for each row execute function set_actual_completion_date();

-- 3) Gỡ toàn bộ RLS policy cũ (dựa trên auth.uid(), giờ luôn null) và tắt RLS — không còn
-- phân biệt được ai đang gọi API nên không thể enforce quyền hạn ở tầng database nữa.
drop policy if exists employees_select on employees;
drop policy if exists employees_update on employees;
drop policy if exists customers_select on customers;
drop policy if exists customers_insert on customers;
drop policy if exists customers_update on customers;
drop policy if exists customer_managers_select on customer_managers;
drop policy if exists customer_managers_write on customer_managers;
drop policy if exists employee_brands_select on employee_brands;
drop policy if exists employee_brands_write on employee_brands;
drop policy if exists seasons_select on seasons;
drop policy if exists seasons_write on seasons;
drop policy if exists steps_select on workflow_step_templates;
drop policy if exists steps_write on workflow_step_templates;
drop policy if exists styles_select on styles;
drop policy if exists styles_write on styles;
drop policy if exists style_assignments_select on style_assignments;
drop policy if exists style_assignments_write on style_assignments;
drop policy if exists style_progress_select on style_progress;
drop policy if exists style_progress_insert on style_progress;
drop policy if exists style_progress_update on style_progress;

alter table employees disable row level security;
alter table customers disable row level security;
alter table customer_managers disable row level security;
alter table employee_brands disable row level security;
alter table seasons disable row level security;
alter table workflow_step_templates disable row level security;
alter table styles disable row level security;
alter table style_assignments disable row level security;
alter table style_progress disable row level security;

drop function if exists my_is_admin();
drop function if exists my_is_brand_leader();
drop function if exists managed_customer_ids();
drop function if exists can_manage_customer(uuid);
drop function if exists my_visible_customer_ids();

-- 4) Cho phép role "anon" (frontend luôn gọi bằng anon key, không còn "authenticated") toàn
-- quyền đọc/ghi — không có gì chặn ở tầng database nữa, đúng như lựa chọn đã xác nhận.
grant select, insert, update, delete on all tables in schema public to anon;
