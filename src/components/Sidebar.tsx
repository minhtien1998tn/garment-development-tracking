import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth, roleLabel } from "@/lib/AuthContext";
import { listMyCustomers } from "@/lib/api";
import type { Customer } from "@/lib/types";

export function Sidebar() {
  const { employee, canManageSettings, logout } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    listMyCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? " active" : ""}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="mark">GARMENT DEV TRACKING</div>
        <div className="sub">Product Development</div>
      </div>

      <nav className="sidebar-body">
        <div className="sidebar-sec">Khách hàng</div>
        {customers.length === 0 && (
          <div className="nav-link" style={{ color: "var(--color-text-3)" }}>
            Chưa có khách hàng
          </div>
        )}
        {customers.map((c) => (
          <NavLink key={c.id} to={`/customers/${c.id}`} className={navLinkClass}>
            {c.name}
          </NavLink>
        ))}

        <div className="sidebar-sec">Hệ thống</div>
        <NavLink to="/timeline" className={navLinkClass}>
          Tổng tiến độ
        </NavLink>
        <NavLink to="/dashboard" className={navLinkClass}>
          Dashboard báo cáo
        </NavLink>
        {canManageSettings && (
          <NavLink to="/settings" className={navLinkClass}>
            Cài đặt chung
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar">{employee?.employee_code.slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {employee?.full_name}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--color-text-3)" }}>
            {employee ? roleLabel(employee.role) : ""}
          </div>
        </div>
        <button className="btn" style={{ padding: "6px 8px" }} onClick={() => logout()}>
          Thoát
        </button>
      </div>
    </aside>
  );
}
