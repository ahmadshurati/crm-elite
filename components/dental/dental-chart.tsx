"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch, fmtDate, fmtMoney, useToast } from "@/components/dental/ui";
import {
  CONDITION_MAP,
  PRIMARY_QUADRANTS,
  QUADRANTS,
  TOOTH_CONDITIONS,
  TOOTH_HISTORY_ACTIONS,
  TOOTH_SURFACES,
} from "@/lib/dental/constants";

type Tooth = { toothNumber: number; condition: string };
type Surface = { toothNumber: number; surface: string; condition: string };

type Panel = {
  toothNumber: number;
  condition: string;
  notes: string | null;
  surfaces: { surface: string; condition: string }[];
  history: { action: string; surface: string | null; condition: string | null; treatment: string | null; doctorName: string | null; notes: string | null; createdAt: string }[];
  treatments: { treatment: string; status: string; price: number }[];
  files?: { id: number; category: string; fileUrl: string; fileName: string }[];
};

export function DentalChart({
  patientId,
  teeth,
  surfaces,
  onChange,
}: {
  patientId: number;
  teeth: Tooth[];
  surfaces: Surface[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [dentition, setDentition] = useState<"permanent" | "primary">("permanent");
  const [selected, setSelected] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [saving, setSaving] = useState(false);

  const condMap = new Map(teeth.map((t) => [t.toothNumber, t.condition]));
  const surfaceCount = new Map<number, number>();
  for (const s of surfaces) {
    if (s.condition !== "healthy") surfaceCount.set(s.toothNumber, (surfaceCount.get(s.toothNumber) || 0) + 1);
  }

  const loadPanel = useCallback(async (tooth: number) => {
    setPanelLoading(true);
    setPanelError(false);
    const r = await apiFetch<Panel>(`/api/dental/patients/${patientId}/teeth/${tooth}`);
    if (r.ok) setPanel(r.data);
    else setPanelError(true);
    setPanelLoading(false);
  }, [patientId]);

  useEffect(() => {
    if (selected != null) loadPanel(selected);
    else setPanel(null);
  }, [selected, loadPanel]);

  async function setToothLevel(condition: string) {
    if (selected == null || saving) return;
    setSaving(true);
    const r = await apiFetch(`/api/dental/patients/${patientId}/teeth`, { method: "PUT", body: JSON.stringify({ toothNumber: selected, condition }) });
    setSaving(false);
    if (r.ok) { toast.success("تم تحديث حالة السن"); await loadPanel(selected); onChange(); }
    else toast.error(r.error);
  }

  async function setSurface(surface: string, condition: string) {
    if (selected == null || saving) return;
    setSaving(true);
    const r = await apiFetch(`/api/dental/patients/${patientId}/teeth`, { method: "PUT", body: JSON.stringify({ toothNumber: selected, surface, condition }) });
    setSaving(false);
    if (r.ok) { toast.success("تم تحديث سطح السن"); await loadPanel(selected); onChange(); }
    else toast.error(r.error);
  }

  const quadrants = dentition === "permanent" ? QUADRANTS : PRIMARY_QUADRANTS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1">
          <button
            onClick={() => { setDentition("permanent"); setSelected(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${dentition === "permanent" ? "bg-white text-[#0F8B94] shadow-sm" : "text-[#64748B]"}`}
          >
            أسنان دائمة
          </button>
          <button
            onClick={() => { setDentition("primary"); setSelected(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${dentition === "primary" ? "bg-white text-[#0F8B94] shadow-sm" : "text-[#64748B]"}`}
          >
            أسنان لبنية
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#EAECEF] bg-white p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {quadrants.map((q) => (
            <div key={q.id}>
              <p className="mb-2 text-center text-[11px] font-bold text-[#94A3B8]">{q.label}</p>
              <div className="flex flex-wrap justify-center gap-1">
                {q.teeth.map((n) => {
                  const cond = condMap.get(n) || "healthy";
                  const info = CONDITION_MAP[cond] || CONDITION_MAP.healthy;
                  const active = selected === n;
                  const hasSurfaces = (surfaceCount.get(n) || 0) > 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelected(active ? null : n)}
                      className={`relative flex h-11 w-9 flex-col items-center justify-center rounded-md border text-[#1F2937] transition ${active ? "ring-2 ring-[#0F8B94]" : "hover:opacity-90"}`}
                      style={{ backgroundColor: info.color, borderColor: "rgba(0,0,0,0.1)" }}
                      title={`سن ${n} — ${info.label}`}
                    >
                      <span className="text-[10px] font-bold">{n}</span>
                      {info.code && <span className="text-[8px] font-black leading-none">{info.code}</span>}
                      {hasSurfaces && <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {TOOTH_CONDITIONS.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] ring-1 ring-[#EAECEF]">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-black/10 text-[8px] font-black text-[#1F2937]" style={{ backgroundColor: c.color }}>{c.code}</span>
            {c.label}
          </span>
        ))}
      </div>

      {/* Tooth panel */}
      {selected != null && (
        <div className="rounded-2xl border border-[#0F8B94]/30 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-lg font-bold text-[#0F8B94]">السن رقم {selected}</h4>
            <div className="flex items-center gap-2">
              {panelLoading && <Loader2 className="h-4 w-4 animate-spin text-[#94A3B8]" />}
              {panelError && <button onClick={() => selected != null && loadPanel(selected)} className="text-xs font-bold text-rose-600 underline">تعذّر التحميل — إعادة</button>}
              <button onClick={() => setSelected(null)} className="rounded-lg px-2 py-1 text-xs font-bold text-[#94A3B8] hover:bg-[#F1F5F9]">إغلاق</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-bold text-[#334155]">حالة السن (كامل)</p>
              <div className="flex flex-wrap gap-1.5">
                {TOOTH_CONDITIONS.map((c) => (
                  <button
                    key={c.id}
                    disabled={saving}
                    onClick={() => setToothLevel(c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition disabled:opacity-50 ${panel?.condition === c.id ? "border-[#0F8B94] bg-[#E7F6F5] text-[#0F8B94]" : "border-[#E5E7EB] bg-white text-[#334155] hover:border-[#0F8B94]"}`}
                  >
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-5 text-sm font-bold text-[#334155]">الأسطح</p>
              <div className="space-y-2">
                {TOOTH_SURFACES.map((s) => {
                  const current = panel?.surfaces.find((x) => x.surface === s.id)?.condition || "healthy";
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F1F5F9] text-[11px] font-black text-[#475569]">{s.short}</span>
                      <span className="w-28 text-xs text-[#64748B]">{s.label}</span>
                      <select
                        value={current}
                        disabled={saving}
                        onChange={(e) => setSurface(s.id, e.target.value)}
                        className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-xs font-bold text-[#334155] outline-none focus:border-[#0F8B94]"
                      >
                        {TOOTH_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              {panel && panel.treatments.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-bold text-[#334155]">العلاجات المرتبطة</p>
                  <div className="space-y-1.5">
                    {panel.treatments.map((t, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs">
                        <span className="font-bold text-[#1F2937]">{t.treatment}</span>
                        <span className="text-[#94A3B8]">{fmtMoney(t.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {panel && panel.files && panel.files.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-bold text-[#334155]">صور وأشعة السن</p>
                  <div className="grid grid-cols-3 gap-2">
                    {panel.files.map((f) => (
                      <a key={f.id} href={f.fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#EAECEF]">
                        <img src={f.fileUrl} alt={f.fileName} className="h-16 w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-2 text-sm font-bold text-[#334155]">تاريخ السن</p>
              {panel && panel.history.length > 0 ? (
                <div className="max-h-[280px] space-y-3 overflow-y-auto pr-3">
                  {panel.history.map((h, i) => (
                    <div key={i} className="border-r-2 border-[#E7F6F5] pr-3">
                      <p className="text-xs font-bold text-[#1F2937]">
                        {TOOTH_HISTORY_ACTIONS[h.action] || h.action}
                        {h.condition && ` · ${CONDITION_MAP[h.condition]?.label || h.condition}`}
                        {h.surface && ` (${h.surface})`}
                      </p>
                      {h.treatment && <p className="text-xs text-[#475569]">{h.treatment}</p>}
                      <p className="text-[11px] text-[#94A3B8]">{fmtDate(h.createdAt)}{h.doctorName ? ` · ${h.doctorName}` : ""}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">لا يوجد تاريخ لهذا السن بعد.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
