import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  listEmployees,
  listAllCustomers,
  listAllEmployeeBrandRows,
  listAllCustomerManagerRows,
  updateEmployee,
  setCustomerManagerScope,
  setEmployeeBrandScope,
} from "@/lib/api";
import { createEmployee, adminResetPassword } from "@/lib/edgeFunctions";
import { roleLabel } from "@/lib/AuthContext";
import type { Customer, Employee, Role } from "@/lib/types";

export function OrgChart() {
  const { isSuperAdmin, isBrandLeader, managedCustomerIds, employee: me } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brandRows, setBrandRows] = useState<{ employee_id: string; customer_id: string }[]>([]);
  const [managerRows, setManagerRows] = useState<{ employee_id: string; customer_id: string }[]>([]);
  const [editingScopeFor, setEditingScopeFor] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("employee");
  const [newBrandIds, setNewBrandIds] = useState<string[]>(isBrandLeader ? managedCustomerIds : []);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setEmployees(await listEmployees());
    setCustomers(await listAllCustomers());
    setBrandRows(await listAllEmployeeBrandRows());
    setManagerRows(await listAllCustomerManagerRows());
  }

  useEffect(() => {
    reload();
  }, []);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  async function handleCreateEmployee() {
    if (!newCode.trim() || !newName.trim() || !newPassword) {
      setFormError("Điền đủ mã NV, họ tên, mật khẩu.");
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      await createEmployee({
        employeeCode: newCode.trim(),
        fullName: newName.trim(),
        password: newPassword,
        role: isSuperAdmin ? newRole : "employee",
        brandCustomerIds: isSuperAdmin ? newBrandIds : managedCustomerIds,
      });
      setNewCode("");
      setNewName("");
      setNewPassword("");
      setNewRole("employee");
      setNewBrandIds(isBrandLeader ? managedCustomerIds : []);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Không tạo được nhân viên.");
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword(employeeId: string) {
    const pwd = window.prompt("Nhập mật khẩu mới cho nhân viên này:");
    if (!pwd) return;
    try {
      await adminResetPassword({ employeeId, newPassword: pwd });
      window.alert("Đã đặt lại mật khẩu.");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Lỗi khi đặt lại mật khẩu.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div className="card-header">Thêm nhân viên mới</div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <input placeholder="Mã NV" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={inputStyle} />
          <input placeholder="Họ tên" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
          <input
            placeholder="Mật khẩu"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
          {isSuperAdmin ? (
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} style={inputStyle}>
              <option value="employee">Nhân viên</option>
              <option value="brand_leader">Brand Leader</option>
              <option value="admin">Admin</option>
            </select>
          ) : (
            <div style={{ ...inputStyle, background: "var(--color-card-2)", color: "var(--color-text-3)" }}>
              Nhân viên (brand của bạn)
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-2)", marginBottom: 6 }}>Đang làm cho brand:</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {customers.map((c) => (
                <label key={c.id} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={newBrandIds.includes(c.id)}
                    onChange={(e) =>
                      setNewBrandIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {formError && <div style={{ padding: "0 16px 12px", color: "var(--color-rose)", fontSize: 13 }}>{formError}</div>}

        <div style={{ padding: "0 16px 16px" }}>
          <button className="btn btn-primary" onClick={handleCreateEmployee} disabled={creating}>
            {creating ? "Đang tạo..." : "+ Thêm nhân viên"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Danh sách nhân viên</div>
        <table className="settings-table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Họ tên</th>
              <th>Role</th>
              <th>Đang làm cho brand</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const brands = brandRows.filter((r) => r.employee_id === emp.id).map((r) => r.customer_id);
              const managed = managerRows.filter((r) => r.employee_id === emp.id).map((r) => r.customer_id);
              return (
                <tr key={emp.id}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{emp.employee_code}</td>
                  <td>{emp.full_name}</td>
                  <td>
                    {isSuperAdmin ? (
                      <select
                        value={emp.role}
                        onChange={(e) =>
                          updateEmployee(emp.id, { role: e.target.value as Role }).then(() => reload())
                        }
                        style={{ fontSize: 12.5 }}
                      >
                        <option value="employee">Nhân viên</option>
                        <option value="brand_leader">Brand Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      roleLabel(emp.role)
                    )}
                    {emp.role === "brand_leader" && (
                      <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                        Quản trị: {managed.map(customerName).join(", ") || "—"}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{brands.map(customerName).join(", ") || "—"}</td>
                  <td>
                    <span className={`badge ${emp.active ? "badge-green" : "badge-gray"}`}>
                      {emp.active ? "Hoạt động" : "Vô hiệu"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    {(isSuperAdmin || managedCustomerIds.some((id) => brands.includes(id))) &&
                      emp.id !== me?.id && (
                        <>
                          <button className="btn" style={{ padding: "4px 8px" }} onClick={() => handleResetPassword(emp.id)}>
                            Reset MK
                          </button>
                          <button
                            className="btn"
                            style={{ padding: "4px 8px" }}
                            onClick={() => updateEmployee(emp.id, { active: !emp.active }).then(() => reload())}
                          >
                            {emp.active ? "Vô hiệu" : "Kích hoạt"}
                          </button>
                        </>
                      )}
                    {isSuperAdmin && (
                      <button
                        className="btn"
                        style={{ padding: "4px 8px" }}
                        onClick={() => setEditingScopeFor(editingScopeFor === emp.id ? null : emp.id)}
                      >
                        Phạm vi
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isSuperAdmin && editingScopeFor && (
        <ScopeEditor
          employee={employees.find((e) => e.id === editingScopeFor)!}
          customers={customers}
          brandRows={brandRows}
          managerRows={managerRows}
          onDone={() => {
            setEditingScopeFor(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ScopeEditor({
  employee,
  customers,
  brandRows,
  managerRows,
  onDone,
}: {
  employee: Employee;
  customers: Customer[];
  brandRows: { employee_id: string; customer_id: string }[];
  managerRows: { employee_id: string; customer_id: string }[];
  onDone: () => void;
}) {
  const [brandIds, setBrandIds] = useState(
    brandRows.filter((r) => r.employee_id === employee.id).map((r) => r.customer_id)
  );
  const [managedIds, setManagedIds] = useState(
    managerRows.filter((r) => r.employee_id === employee.id).map((r) => r.customer_id)
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setEmployeeBrandScope(employee.id, brandIds);
      if (employee.role === "brand_leader") {
        await setCustomerManagerScope(employee.id, managedIds);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">Phạm vi — {employee.full_name}</div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--color-text-2)", marginBottom: 6 }}>Đang làm cho brand:</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {customers.map((c) => (
            <label key={c.id} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="checkbox"
                checked={brandIds.includes(c.id)}
                onChange={(e) =>
                  setBrandIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                }
              />
              {c.name}
            </label>
          ))}
        </div>

        {employee.role === "brand_leader" && (
          <>
            <div style={{ fontSize: 12, color: "var(--color-text-2)", marginBottom: 6 }}>
              Quản trị (Brand Leader) cho:
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              {customers.map((c) => (
                <label key={c.id} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={managedIds.includes(c.id)}
                    onChange={(e) =>
                      setManagedIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </>
        )}

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu phạm vi"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  fontSize: 13,
};
