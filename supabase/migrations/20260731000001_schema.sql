-- PDC Tracker — schema chính.
-- "customer" trong schema này chính là "brand" nhắc tới trong yêu cầu nghiệp vụ.

create extension if not exists pgcrypto;

create table employees (
  id             uuid primary key references auth.users(id) on delete cascade,
  employee_code  text not null unique,
  full_name      text not null,
  role           text not null default 'employee' check (role in ('admin', 'brand_leader', 'employee')),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table customers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0
);

-- Brand nào do Brand Leader nào quản trị — nguồn duy nhất xác định phạm vi Brand Leader.
create table customer_managers (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  employee_id  uuid not null references employees(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (customer_id, employee_id)
);

-- Nhân viên (mọi role) đang làm cho brand nào — CHỈ để lọc danh sách chọn NV khi phân công,
-- KHÔNG phải bảng phân quyền (khác customer_managers).
create table employee_brands (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (employee_id, customer_id)
);

create table seasons (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  unique (customer_id, name)
);

-- Bước công việc / milestone — cấu hình riêng theo từng khách hàng (Proto1/2/3, SMS, Sizeset, PPS...).
create table workflow_step_templates (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  unique (customer_id, name)
);

create table styles (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  season_id   uuid not null references seasons(id) on delete cascade,
  style_code  text not null,
  style_name  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (customer_id, season_id, style_code)
);

create table style_assignments (
  id           uuid primary key default gen_random_uuid(),
  style_id     uuid not null references styles(id) on delete cascade,
  employee_id  uuid not null references employees(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  unique (style_id, employee_id)
);

-- 1 dòng = 1 ô giao (style x bước công việc) — dữ liệu hiển thị trên timeline + lưới ma trận.
create table style_progress (
  id                       uuid primary key default gen_random_uuid(),
  style_id                 uuid not null references styles(id) on delete cascade,
  step_template_id         uuid not null references workflow_step_templates(id) on delete cascade,
  deadline_date            date,
  expected_completion_date date,
  actual_completion_date   date,
  is_completed             boolean not null default false,
  remark                   text,
  updated_by               uuid references employees(id),
  updated_at               timestamptz not null default now(),
  unique (style_id, step_template_id)
);

create index idx_customer_managers_employee on customer_managers(employee_id);
create index idx_employee_brands_employee on employee_brands(employee_id);
create index idx_employee_brands_customer on employee_brands(customer_id);
create index idx_seasons_customer on seasons(customer_id);
create index idx_steps_customer on workflow_step_templates(customer_id);
create index idx_styles_customer_season on styles(customer_id, season_id);
create index idx_style_assignments_employee on style_assignments(employee_id);
create index idx_style_assignments_style on style_assignments(style_id);
create index idx_style_progress_style on style_progress(style_id);
