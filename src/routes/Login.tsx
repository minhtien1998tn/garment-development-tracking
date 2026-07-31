import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { Employee } from "@/lib/types";

export function Login() {
  const { employee, loading, selectEmployee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && employee) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data } = await supabase
      .from("employees")
      .select("*")
      .ilike("employee_code", employeeCode.trim())
      .eq("active", true)
      .maybeSingle<Employee>();

    setSubmitting(false);

    if (!data) {
      setError("Mã nhân viên không hợp lệ.");
      return;
    }

    await selectEmployee(data.id);
    navigate("/", { replace: true });
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
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, padding: 28 }}>
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

        <label style={fieldLabelStyle}>Mã nhân viên</label>
        <input
          autoFocus
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          placeholder="vd: NV001"
          style={inputStyle}
        />

        {error && (
          <div style={{ color: "var(--color-rose)", fontSize: 13, margin: "10px 0" }}>{error}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !employeeCode.trim()}
          style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
        >
          {submitting ? "Đang kiểm tra..." : "Vào hệ thống"}
        </button>
      </form>
    </div>
  );
}

const fieldLabelStyle = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--color-text-2)",
  marginBottom: 6,
  marginTop: 12,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  fontSize: 14,
  outline: "none",
};
