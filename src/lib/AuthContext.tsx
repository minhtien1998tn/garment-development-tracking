import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabaseClient";
import type { Employee, Role } from "./types";

const STORAGE_KEY = "gdt_current_employee_id";

interface AuthState {
  loading: boolean;
  employee: Employee | null;
  managedCustomerIds: string[];
  isSuperAdmin: boolean;
  isBrandLeader: boolean;
  canManageCustomer: (customerId: string) => boolean;
  canManageSettings: boolean;
  selectEmployee: (employeeId: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [managedCustomerIds, setManagedCustomerIds] = useState<string[]>([]);

  async function loadEmployee(id: string) {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle<Employee>();

    if (!emp) {
      setEmployee(null);
      setManagedCustomerIds([]);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    setEmployee(emp);

    if (emp.role === "brand_leader") {
      const { data: rows } = await supabase
        .from("customer_managers")
        .select("customer_id")
        .eq("employee_id", emp.id);
      setManagedCustomerIds((rows ?? []).map((r) => r.customer_id as string));
    } else {
      setManagedCustomerIds([]);
    }
  }

  async function refresh() {
    setLoading(true);
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      await loadEmployee(id);
    } else {
      setEmployee(null);
      setManagedCustomerIds([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectEmployee(employeeId: string) {
    localStorage.setItem(STORAGE_KEY, employeeId);
    await loadEmployee(employeeId);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setEmployee(null);
    setManagedCustomerIds([]);
  }

  const isSuperAdmin = employee?.role === "admin";
  const isBrandLeader = employee?.role === "brand_leader";

  function canManageCustomer(customerId: string) {
    if (isSuperAdmin) return true;
    if (isBrandLeader) return managedCustomerIds.includes(customerId);
    return false;
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      employee,
      managedCustomerIds,
      isSuperAdmin,
      isBrandLeader,
      canManageCustomer,
      canManageSettings: isSuperAdmin || isBrandLeader,
      selectEmployee,
      logout,
      refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, employee, managedCustomerIds]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong AuthProvider");
  return ctx;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "Quản trị hệ thống";
    case "brand_leader":
      return "Brand Leader";
    case "employee":
      return "Nhân viên";
  }
}
