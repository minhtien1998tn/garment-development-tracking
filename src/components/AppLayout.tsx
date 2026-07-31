import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/lib/AuthContext";

export function AppLayout() {
  const { loading, employee } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Đang tải...</div>;
  if (!employee) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}

export function SettingsGuard() {
  const { canManageSettings } = useAuth();
  if (!canManageSettings) return <Navigate to="/" replace />;
  return <Outlet />;
}
