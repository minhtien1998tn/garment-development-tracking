import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  listAllCustomers,
  listSeasons,
  listStylesForCustomer,
  listAssignmentsForStyle,
  listEmployees,
  listEmployeeBrands,
  bulkSaveStyles,
  type StyleGridRow,
  type BulkSaveWarning,
} from "@/lib/api";
import type { Customer, Employee, Season } from "@/lib/types";

interface Row {
  styleCode: string;
  styleName: string;
  employeeCodesRaw: string;
}

const EMPTY_TRAILING_ROWS = 5;
const COLS = 3; // styleCode, styleName, employeeCodesRaw

function emptyRow(): Row {
  return { styleCode: "", styleName: "", employeeCodesRaw: "" };
}

export function StylesAssignmentGrid() {
  const { canManageCustomer } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [brandEmployeeCodes, setBrandEmployeeCodes] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<BulkSaveWarning[]>([]);
  const [saving, setSaving] = useState(false);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    listAllCustomers().then(setCustomers);
    listEmployees().then(setAllEmployees);
  }, []);

  useEffect(() => {
    if (!customerId) return;
    listSeasons(customerId).then((list) => {
      setSeasons(list);
      setSeasonId(list[0]?.id ?? "");
    });
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    listEmployeeBrands(customerId).then((empIds) => {
      const codes = allEmployees.filter((e) => empIds.includes(e.id)).map((e) => e.employee_code);
      setBrandEmployeeCodes(codes);
    });
  }, [customerId, allEmployees]);

  useEffect(() => {
    if (!customerId || !seasonId) {
      setRows(Array.from({ length: EMPTY_TRAILING_ROWS }, emptyRow));
      return;
    }
    (async () => {
      const styles = await listStylesForCustomer(customerId, seasonId);
      const loaded: Row[] = [];
      for (const s of styles) {
        const assigns = await listAssignmentsForStyle(s.id);
        const codes = assigns
          .map((a) => allEmployees.find((e) => e.id === a.employee_id)?.employee_code)
          .filter(Boolean) as string[];
        loaded.push({ styleCode: s.style_code, styleName: s.style_name ?? "", employeeCodesRaw: codes.join(", ") });
      }
      setRows([...loaded, ...Array.from({ length: EMPTY_TRAILING_ROWS }, emptyRow)]);
    })();
  }, [customerId, seasonId, allEmployees]);

  function ensureRowCount(n: number) {
    setRows((prev) => {
      if (prev.length >= n) return prev;
      return [...prev, ...Array.from({ length: n - prev.length }, emptyRow)];
    });
  }

  function setCell(rowIdx: number, col: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [col]: value };
      return next;
    });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single value: browser handles normally

    e.preventDefault();
    const grid = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line, i, arr) => !(i === arr.length - 1 && line === ""))
      .map((line) => line.split("\t"));

    ensureRowCount(rowIdx + grid.length);

    setRows((prev) => {
      const next = [...prev];
      grid.forEach((lineCells, r) => {
        const target = rowIdx + r;
        if (!next[target]) next[target] = emptyRow();
        lineCells.forEach((cellVal, c) => {
          const col = colIdx + c;
          if (col >= COLS) return;
          const key = (["styleCode", "styleName", "employeeCodesRaw"] as const)[col];
          next[target] = { ...next[target], [key]: cellVal };
        });
      });
      return next;
    });
  }

  function focusCell(rowIdx: number, colIdx: number) {
    cellRefs.current.get(`${rowIdx}-${colIdx}`)?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      ensureRowCount(rowIdx + 2);
      focusCell(rowIdx + 1, colIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
    }
  }

  async function handleSaveAll() {
    if (!customerId || !seasonId) return;
    setSaving(true);
    setWarnings([]);
    try {
      const validMap = new Map<string, string>();
      for (const code of brandEmployeeCodes) {
        const emp = allEmployees.find((e) => e.employee_code === code);
        if (emp) validMap.set(code.toLowerCase(), emp.id);
      }

      const gridRows: StyleGridRow[] = rows
        .filter((r) => r.styleCode.trim())
        .map((r) => ({
          styleCode: r.styleCode.trim(),
          styleName: r.styleName.trim(),
          employeeCodes: r.employeeCodesRaw.split(",").map((c) => c.trim()).filter(Boolean),
        }));

      const { warnings: w } = await bulkSaveStyles(customerId, seasonId, gridRows, validMap);
      setWarnings(w);

      const styles = await listStylesForCustomer(customerId, seasonId);
      const loaded: Row[] = [];
      for (const s of styles) {
        const assigns = await listAssignmentsForStyle(s.id);
        const codes = assigns
          .map((a) => allEmployees.find((e) => e.id === a.employee_id)?.employee_code)
          .filter(Boolean) as string[];
        loaded.push({ styleCode: s.style_code, styleName: s.style_name ?? "", employeeCodesRaw: codes.join(", ") });
      }
      setRows([...loaded, ...Array.from({ length: EMPTY_TRAILING_ROWS }, emptyRow)]);
    } finally {
      setSaving(false);
    }
  }

  const canEdit = customerId ? canManageCustomer(customerId) : false;
  const colKeys: (keyof Row)[] = ["styleCode", "styleName", "employeeCodesRaw"];

  return (
    <div className="card">
      <div className="card-header">Mã hàng &amp; Phân công</div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={selectStyle}>
            <option value="">— Chọn khách hàng —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} style={selectStyle} disabled={!customerId}>
            <option value="">— Chọn mùa —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {!canEdit && customerId && (
          <div style={{ color: "var(--color-text-3)", fontSize: 13, marginBottom: 10 }}>
            Bạn chỉ có thể xem — không có quyền chỉnh sửa khách hàng này.
          </div>
        )}

        {customerId && seasonId && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="settings-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Style No</th>
                    <th>Style Name</th>
                    <th style={{ width: 260 }}>Mã NV phụ trách (vd: NV001, NV002)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {colKeys.map((key, colIdx) => (
                        <td key={key} style={{ padding: 2 }}>
                          <input
                            ref={(el) => {
                              if (el) cellRefs.current.set(`${rowIdx}-${colIdx}`, el);
                            }}
                            value={row[key]}
                            disabled={!canEdit}
                            onChange={(e) => setCell(rowIdx, key, e.target.value)}
                            onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            style={cellStyle}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn" onClick={() => ensureRowCount(rows.length + EMPTY_TRAILING_ROWS)}>
                  + Thêm dòng
                </button>
                <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu tất cả"}
                </button>
              </div>
            )}

            {warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {warnings.map((w, i) => (
                  <div key={i} className="badge badge-amber" style={{ display: "block", marginBottom: 4 }}>
                    {w.styleCode}: {w.message}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "8px 12px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  fontSize: 13,
};

const cellStyle = {
  width: "100%",
  border: "1px solid transparent",
  padding: "6px 8px",
  fontSize: 13,
  borderRadius: 6,
};
