import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, EMPLOYEE_EMAIL_DOMAIN } from "./supabaseClient";
import type { Employee, Role } from "./types";

interface AuthState {
  loading: boolean;
  employee: Employee | null;
  managedCustomerIds: string[];
  isSuperAdmin: boolean;
  isBrandLeader: boolean;
  canManageCustomer: (customerId: string) => boolean;
  canManageSettings: boolean;
  login: (employeeCode: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function employeeCodeToEmail(employeeCode: string): string {
  return `${employeeCode.trim().toLowerCase()}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [managedCustomerIds, setManagedCustomerIds] = useState<string[]>([]);

  async function loadEmployee(userId: string) {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", userId)
      .eq("active", true)
      .maybeSingle<Employee>();

    if (!emp) {
      setEmployee(null);
      setManagedCustomerIds([]);
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
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) {
      await loadEmployee(userId);
    } else {
      setEmployee(null);
      setManagedCustomerIds([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id) {
        loadEmployee(session.user.id);
      } else {
        setEmployee(null);
        setManagedCustomerIds([]);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(employeeCode: string, password: string) {
    const email = employeeCodeToEmail(employeeCode);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Mã nhân viên hoặc mật khẩu không đúng." };
    return { error: null };
  }

  async function logout() {
    await supabase.auth.signOut();
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
      login,
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
