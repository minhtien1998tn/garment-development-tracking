import { NavLink, Outlet } from "react-router-dom";
import { Topbar } from "@/components/Topbar";

export function SettingsLayout() {
  const tabClass = ({ isActive }: { isActive: boolean }) => `tab-btn${isActive ? " active" : ""}`;

  return (
    <>
      <Topbar title="Cài đặt chung" />
      <div className="content">
        <div className="tab-btns" style={{ marginBottom: 18 }}>
          <NavLink to="/settings" end className={tabClass}>
            1. Thông tin chung
          </NavLink>
          <NavLink to="/settings/org-chart" className={tabClass}>
            2. Sơ đồ tổ chức
          </NavLink>
          <NavLink to="/settings/styles" className={tabClass}>
            3. Mã hàng &amp; Phân công
          </NavLink>
        </div>
        <Outlet />
      </div>
    </>
  );
}
