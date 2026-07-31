-- Row Level Security: 3 cấp quyền admin / brand_leader / employee.
-- Tất cả helper function dùng SECURITY DEFINER + search_path cố định để tránh đệ quy RLS
-- (vd: policy trên "employees" mà lại query "employees" trực tiếp sẽ đệ quy vô hạn).

create or replace function my_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from employees where id = auth.uid()), false);
$$;

create or replace function my_is_brand_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'brand_leader' from employees where id = auth.uid()), false);
$$;

-- Brand (customer) nào 1 Brand Leader được giao quản trị.
create or replace function managed_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select customer_id from customer_managers where employee_id = auth.uid();
$$;

create or replace function can_manage_customer(target_customer_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select my_is_admin() or exists (
    select 1 from customer_managers
    where employee_id = auth.uid() and customer_id = target_customer_id
  );
$$;

-- Phạm vi "nhìn thấy" brand — rộng hơn managed_customer_ids(): bao gồm cả brand mà 1 Employee
-- có ít nhất 1 mã hàng được giao. Dùng cho SELECT trên customers/seasons/workflow_step_templates.
create or replace function my_visible_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from customers where my_is_admin()
  union
  select customer_id from customer_managers where employee_id = auth.uid()
  union
  select distinct s.customer_id
    from styles s
    join style_assignments sa on sa.style_id = s.id
   where sa.employee_id = auth.uid();
$$;

alter table employees enable row level security;
alter table customers enable row level security;
alter table customer_managers enable row level security;
alter table employee_brands enable row level security;
alter table seasons enable row level security;
alter table workflow_step_templates enable row level security;
alter table styles enable row level security;
alter table style_assignments enable row level security;
alter table style_progress enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------

create policy employees_select on employees for select to authenticated using (
  my_is_admin()
  or id = auth.uid()
  or (my_is_brand_leader() and exists (
        select 1 from employee_brands eb
        where eb.employee_id = employees.id and eb.customer_id in (select managed_customer_ids())
      ))
);

create policy employees_update on employees for update to authenticated using (
  my_is_admin()
  or id = auth.uid()
  or (my_is_brand_leader() and exists (
        select 1 from employee_brands eb
        where eb.employee_id = employees.id and eb.customer_id in (select managed_customer_ids())
      ))
);

-- Không có policy INSERT/DELETE cho authenticated/anon: tạo nhân viên chỉ qua Edge Function
-- "create-employee" (dùng service role, bỏ qua RLS). Vô hiệu hoá nhân viên dùng UPDATE active=false.

create or replace function enforce_employee_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not my_is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Chỉ Admin được đổi role nhân viên.';
    end if;
    if new.employee_code is distinct from old.employee_code then
      raise exception 'Không được đổi mã nhân viên.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_employee_update
  before update on employees
  for each row execute function enforce_employee_update();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create policy customers_select on customers for select to authenticated using (
  id in (select my_visible_customer_ids())
);

create policy customers_insert on customers for insert to authenticated with check (my_is_admin());

create policy customers_update on customers for update to authenticated using (can_manage_customer(id));

-- ---------------------------------------------------------------------------
-- customer_managers (chỉ Admin cấp/thu hồi quyền Brand Leader)
-- ---------------------------------------------------------------------------

create policy customer_managers_select on customer_managers for select to authenticated using (
  my_is_admin() or employee_id = auth.uid() or customer_id in (select managed_customer_ids())
);

create policy customer_managers_write on customer_managers for all to authenticated
  using (my_is_admin()) with check (my_is_admin());

-- ---------------------------------------------------------------------------
-- employee_brands (roster theo brand — Admin hoặc Brand Leader của brand đó quản lý)
-- ---------------------------------------------------------------------------

create policy employee_brands_select on employee_brands for select to authenticated using (
  my_is_admin() or employee_id = auth.uid() or customer_id in (select managed_customer_ids())
);

create policy employee_brands_write on employee_brands for all to authenticated
  using (can_manage_customer(customer_id)) with check (can_manage_customer(customer_id));

-- ---------------------------------------------------------------------------
-- seasons / workflow_step_templates (cấu hình theo brand)
-- ---------------------------------------------------------------------------

create policy seasons_select on seasons for select to authenticated using (
  customer_id in (select my_visible_customer_ids())
);

create policy seasons_write on seasons for all to authenticated
  using (can_manage_customer(customer_id)) with check (can_manage_customer(customer_id));

create policy steps_select on workflow_step_templates for select to authenticated using (
  customer_id in (select my_visible_customer_ids())
);

create policy steps_write on workflow_step_templates for all to authenticated
  using (can_manage_customer(customer_id)) with check (can_manage_customer(customer_id));

-- ---------------------------------------------------------------------------
-- styles
-- ---------------------------------------------------------------------------

create policy styles_select on styles for select to authenticated using (
  can_manage_customer(customer_id)
  or exists (select 1 from style_assignments sa where sa.style_id = styles.id and sa.employee_id = auth.uid())
);

create policy styles_write on styles for all to authenticated
  using (can_manage_customer(customer_id)) with check (can_manage_customer(customer_id));

-- ---------------------------------------------------------------------------
-- style_assignments
-- ---------------------------------------------------------------------------

create policy style_assignments_select on style_assignments for select to authenticated using (
  employee_id = auth.uid()
  or exists (
    select 1 from styles s where s.id = style_assignments.style_id and can_manage_customer(s.customer_id)
  )
);

create policy style_assignments_write on style_assignments for all to authenticated using (
  exists (select 1 from styles s where s.id = style_assignments.style_id and can_manage_customer(s.customer_id))
) with check (
  exists (select 1 from styles s where s.id = style_assignments.style_id and can_manage_customer(s.customer_id))
);

-- ---------------------------------------------------------------------------
-- style_progress — bảng dữ liệu chính (timeline + lưới ma trận)
-- ---------------------------------------------------------------------------

create policy style_progress_select on style_progress for select to authenticated using (
  exists (
    select 1 from styles s
    where s.id = style_progress.style_id
      and (
        can_manage_customer(s.customer_id)
        or exists (select 1 from style_assignments sa where sa.style_id = s.id and sa.employee_id = auth.uid())
      )
  )
);

create policy style_progress_insert on style_progress for insert to authenticated with check (
  exists (select 1 from styles s where s.id = style_progress.style_id and can_manage_customer(s.customer_id))
);

-- Employee được giao style vẫn UPDATE được (ngày dự kiến/tick hoàn thành/remark) — giới hạn cột
-- deadline_date thực hiện bằng trigger bên dưới, RLS chỉ kiểm tra quyền truy cập dòng.
create policy style_progress_update on style_progress for update to authenticated using (
  exists (
    select 1 from styles s
    where s.id = style_progress.style_id
      and (
        can_manage_customer(s.customer_id)
        or exists (select 1 from style_assignments sa where sa.style_id = s.id and sa.employee_id = auth.uid())
      )
  )
);

create or replace function enforce_style_progress_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id from styles where id = new.style_id;

  if not can_manage_customer(v_customer_id) and new.deadline_date is distinct from old.deadline_date then
    raise exception 'Chỉ Admin/Brand Leader mới được sửa deadline.';
  end if;

  if new.is_completed then
    if new.actual_completion_date is null then
      new.actual_completion_date := current_date;
    end if;
  else
    new.actual_completion_date := null;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();

  return new;
end;
$$;

create trigger trg_enforce_style_progress_update
  before update on style_progress
  for each row execute function enforce_style_progress_update();
