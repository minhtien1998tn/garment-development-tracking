import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  listAllCustomers,
  createCustomer,
  updateCustomer,
  listSeasons,
  createSeason,
  updateSeason,
  listStepTemplatesAll,
  createStepTemplate,
  updateStepTemplate,
  reorderStepTemplates,
} from "@/lib/api";
import type { Customer, Season, WorkflowStepTemplate } from "@/lib/types";

export function GeneralInfo() {
  const { isSuperAdmin, canManageCustomer } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [steps, setSteps] = useState<WorkflowStepTemplate[]>([]);

  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newStepName, setNewStepName] = useState("");

  async function reloadCustomers() {
    const list = await listAllCustomers();
    setCustomers(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
  }

  useEffect(() => {
    reloadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    listSeasons(selectedId).then(setSeasons);
    listStepTemplatesAll(selectedId).then(setSteps);
  }, [selectedId]);

  const canEdit = selectedId ? canManageCustomer(selectedId) : false;

  async function handleAddCustomer() {
    if (!newCustomerCode.trim() || !newCustomerName.trim()) return;
    const c = await createCustomer(newCustomerCode.trim(), newCustomerName.trim());
    setNewCustomerCode("");
    setNewCustomerName("");
    await reloadCustomers();
    setSelectedId(c.id);
  }

  async function handleAddSeason() {
    if (!selectedId || !newSeasonName.trim()) return;
    const s = await createSeason(selectedId, newSeasonName.trim());
    setSeasons((prev) => [...prev, s]);
    setNewSeasonName("");
  }

  async function handleAddStep() {
    if (!selectedId || !newStepName.trim()) return;
    const sortOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.sort_order)) + 1 : 0;
    const step = await createStepTemplate(selectedId, newStepName.trim(), sortOrder);
    setSteps((prev) => [...prev, step]);
    setNewStepName("");
  }

  async function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[index];
    const b = steps[target];
    await reorderStepTemplates([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
    const next = [...steps];
    next[index] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    next.sort((x, y) => x.sort_order - y.sort_order);
    setSteps(next);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
      <div className="card">
        <div className="card-header">Khách hàng</div>
        <div style={{ padding: 10 }}>
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`nav-link${selectedId === c.id ? " active" : ""}`}
              style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer", marginBottom: 4 }}
            >
              {c.name} {!c.active && <span className="badge badge-gray">Ẩn</span>}
            </button>
          ))}

          {isSuperAdmin && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
              <input
                placeholder="Mã KH"
                value={newCustomerCode}
                onChange={(e) => setNewCustomerCode(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Tên khách hàng"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }}
              />
              <button className="btn btn-primary" style={{ marginTop: 8, width: "100%" }} onClick={handleAddCustomer}>
                + Thêm khách hàng
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {canEdit && (
            <div className="card">
              <div className="card-header">Thông tin khách hàng</div>
              <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  value={customers.find((c) => c.id === selectedId)?.name ?? ""}
                  onChange={(e) =>
                    setCustomers((prev) =>
                      prev.map((c) => (c.id === selectedId ? { ...c, name: e.target.value } : c))
                    )
                  }
                  onBlur={(e) => updateCustomer(selectedId, { name: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  className="btn"
                  onClick={() => {
                    const c = customers.find((x) => x.id === selectedId);
                    if (!c) return;
                    updateCustomer(selectedId, { active: !c.active }).then((updated) =>
                      setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                    );
                  }}
                >
                  {customers.find((c) => c.id === selectedId)?.active ? "Ẩn khách hàng" : "Hiện khách hàng"}
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">Mùa (Season)</div>
            <div style={{ padding: 14 }}>
              {seasons.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  {!s.active && <span className="badge badge-gray">Ẩn</span>}
                  {canEdit && (
                    <button
                      className="btn"
                      style={{ padding: "4px 8px" }}
                      onClick={() => {
                        updateSeason(s.id, { active: !s.active }).then((updated) =>
                          setSeasons((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                        );
                      }}
                    >
                      {s.active ? "Ẩn" : "Hiện"}
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    placeholder="Tên mùa, vd: Spring/Summer 2027"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleAddSeason}>
                    + Thêm
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Bước công việc (áp dụng cho mọi mã hàng của khách hàng này)</div>
            <div style={{ padding: 14 }}>
              {steps.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  {!s.active && <span className="badge badge-gray">Ẩn</span>}
                  {canEdit && (
                    <>
                      <button className="btn" style={{ padding: "4px 8px" }} onClick={() => moveStep(i, -1)}>
                        ↑
                      </button>
                      <button className="btn" style={{ padding: "4px 8px" }} onClick={() => moveStep(i, 1)}>
                        ↓
                      </button>
                      <button
                        className="btn"
                        style={{ padding: "4px 8px" }}
                        onClick={() => {
                          updateStepTemplate(s.id, { active: !s.active }).then((updated) =>
                            setSteps((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                          );
                        }}
                      >
                        {s.active ? "Ẩn" : "Hiện"}
                      </button>
                    </>
                  )}
                </div>
              ))}
              {canEdit && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    placeholder="Tên bước, vd: Proto 1"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleAddStep}>
                    + Thêm
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  fontSize: 13,
};
