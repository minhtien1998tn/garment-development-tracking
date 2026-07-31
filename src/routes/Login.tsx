import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export function Login() {
  const { employee, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
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
    const { error } = await login(employeeCode, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
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
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, padding: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 26,
              color: "var(--color-orange)",
            }}
          >
            PDC TRACKER
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

        <label style={fieldLabelStyle}>Mật khẩu</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div style={{ color: "var(--color-rose)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !employeeCode || !password}
          style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
        >
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
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
