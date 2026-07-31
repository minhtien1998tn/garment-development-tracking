import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { listAllCustomers, listEmployeesForCustomer } from "@/lib/api";
import type { Customer, Employee } from "@/lib/types";

export function Login() {
  const { employee, loading, selectEmployee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingStep, setLoadingStep] = useState(false);

  useEffect(() => {
    listAllCustomers().then((list) => setCustomers(list.filter((c) => c.active)));
  }, []);

  if (!loading && employee) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handlePickCustomer(c: Customer) {
    setCustomer(c);
    setLoadingStep(true);
    setEmployees(await listEmployeesForCustomer(c.id));
    setLoadingStep(false);
  }

  async function handlePickEmployee(emp: Employee) {
    await selectEmployee(emp.id);
    navigate(customer ? `/customers/${customer.id}` : "/", { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: 20,
      }}
    >
      <div className="card" style={{ width: 420, padding: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 22,
              color: "var(--color-orange)",
            }}
          >
            GARMENT DEV TRACKING
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--color-text-3)",
            }}
          >
            Quản lý tiến độ phát triển sản phẩm
          </div>
        </div>

        {!customer ? (
          <>
            <div style={stepLabelStyle}>Bước 1 — Chọn khách hàng</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {customers.length === 0 && (
                <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>Đang tải...</div>
              )}
              {customers.map((c) => (
                <button key={c.id} className="btn" style={pickButtonStyle} onClick={() => handlePickCustomer(c)}>
                  {c.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={stepLabelStyle}>
              Bước 2 — Chọn tên bạn{" "}
              <button
                onClick={() => {
                  setCustomer(null);
                  setEmployees([]);
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--color-orange-dark)",
                  cursor: "pointer",
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                (đổi khách hàng)
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {loadingStep && <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>Đang tải...</div>}
              {!loadingStep && employees.length === 0 && (
                <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>
                  Chưa có nhân viên nào được gán cho khách hàng "{customer.name}".
                </div>
              )}
              {employees.map((emp) => (
                <button key={emp.id} className="btn" style={pickButtonStyle} onClick={() => handlePickEmployee(emp)}>
                  {emp.full_name}
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-3)" }}>
                    {emp.employee_code}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const stepLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--color-text-2)",
  marginBottom: 10,
};

const pickButtonStyle = {
  width: "100%",
  justifyContent: "flex-start",
  textAlign: "left" as const,
};
