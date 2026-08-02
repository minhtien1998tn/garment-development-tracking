-- Phân cấp bước công việc thành 2 cấp:
--   Cấp 1 (workflow_phases)      = Giai đoạn thực hiện (vd: "Phát triển mẫu", "Duyệt mẫu")
--   Cấp 2 (workflow_step_templates, đã có sẵn) = bước công việc con thuộc 1 giai đoạn
--                                   (vd: Proto 1, Proto 2, SMS...) — vẫn là nơi style_progress
--                                   gắn vào (không đổi khoá style_progress.step_template_id).

create table workflow_phases (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  unique (customer_id, name)
);

create index idx_workflow_phases_customer on workflow_phases(customer_id);

alter table workflow_step_templates add column phase_id uuid references workflow_phases(id) on delete cascade;

-- Backfill: mỗi khách hàng đang có bước công việc được gom vào 1 giai đoạn mặc định "Giai đoạn 1"
-- — admin/brand leader vào Cài đặt chung để đặt lại tên/tách nhỏ giai đoạn theo ý muốn.
insert into workflow_phases (customer_id, name, sort_order)
select distinct customer_id, 'Giai đoạn 1', 0
from workflow_step_templates
on conflict (customer_id, name) do nothing;

update workflow_step_templates st
set phase_id = wp.id
from workflow_phases wp
where wp.customer_id = st.customer_id and wp.name = 'Giai đoạn 1' and st.phase_id is null;

alter table workflow_step_templates alter column phase_id set not null;
create index idx_workflow_steps_phase on workflow_step_templates(phase_id);

-- Đã bỏ RLS ở migration trước — mở quyền anon cho bảng mới này (grant cũ chỉ áp dụng cho các
-- bảng tồn tại lúc chạy, bảng tạo sau không tự động được cấp).
grant select, insert, update, delete on workflow_phases to anon;
