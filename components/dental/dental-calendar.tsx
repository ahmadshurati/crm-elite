"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Wallet, X } from "lucide-react";
import { apiFetch, fmtDateTime, useToast } from "@/components/dental/ui";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_MAP } from "@/lib/dental/constants";

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";
const DAY_START = 8;
const DAY_END = 20;
const PX_PER_MIN = 56 / 60;
const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Appt = { id: number; patientId: number; patientName: string; doctorName: string | null; treatmentType: string | null; startAt: string; durationMin: number; room: string | null; status: string };
type Conflict = { id: number; patientName: string; doctorName: string | null; room: string | null; startAt: string; durationMin: number };
type PatientRow = { id: number; patientNumber: string; fullName: string };

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const offset = (x.getDay() + 1) % 7; // week starts Saturday
  x.setDate(x.getDate() - offset);
  return x;
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DentalCalendar({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [view, setView] = useState<"day" | "week">("day");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [selected, setSelected] = useState<Appt | null>(null);
  const [creating, setCreating] = useState<Date | null>(null);

  const days = useMemo(() => {
    if (view === "day") return [new Date(anchor)];
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const from = ymd(days[0]);
    const to = ymd(days[days.length - 1]);
    const url = view === "day" ? `/api/dental/appointments?date=${from}` : `/api/dental/appointments?from=${from}&to=${to}`;
    const r = await apiFetch<{ appointments: Appt[] }>(url);
    if (r.ok) setAppts(r.data.appointments || []);
    else setErr(r.error);
    setLoading(false);
  }, [days, view]);

  useEffect(() => { load(); }, [load]);

  const doctors = useMemo(() => Array.from(new Set(appts.map((a) => a.doctorName).filter(Boolean))) as string[], [appts]);
  const rooms = useMemo(() => Array.from(new Set(appts.map((a) => a.room).filter(Boolean))) as string[], [appts]);
  const visible = appts.filter((a) => (!doctorFilter || a.doctorName === doctorFilter) && (!roomFilter || a.room === roomFilter));

  function shift(dir: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * (view === "day" ? 1 : 7));
    setAnchor(d);
  }

  const label = view === "day"
    ? anchor.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString("ar", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString("ar", { day: "numeric", month: "short" })}`;

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#1F2937]">التقويم والمواعيد</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#E5E7EB] bg-white p-0.5">
            {(["day", "week"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${view === v ? "bg-[#0F8B94] text-white" : "text-[#475569]"}`}>{v === "day" ? "يوم" : "أسبوع"}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#475569] hover:bg-[#F8FAFC]"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); }} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC]">اليوم</button>
            <button onClick={() => shift(1)} className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#475569] hover:bg-[#F8FAFC]"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <button onClick={() => setCreating(new Date(anchor.getTime() + DAY_START * 3600000))} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
            <Plus className="h-4 w-4" /> موعد جديد
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#334155]">{label}</p>
        <div className="flex items-center gap-2">
          {doctors.length > 0 && (
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm">
              <option value="">كل الأطباء</option>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {rooms.length > 0 && (
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm">
              <option value="">كل الغرف</option>
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20 text-[#94A3B8]"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : err ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-semibold text-[#475569]">{err}</p>
            <button onClick={load} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">إعادة المحاولة</button>
          </div>
        ) : (
          <div className="flex min-w-[640px]">
            {/* hour labels */}
            <div className="w-14 shrink-0 border-l border-[#F1F5F9] pt-10">
              {hours.map((h) => (
                <div key={h} className="relative text-left" style={{ height: 60 * PX_PER_MIN }}>
                  <span className="absolute -top-2 right-1 text-[10px] text-[#94A3B8]">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* day columns */}
            <div className="flex flex-1">
              {days.map((day) => {
                const dayAppts = visible.filter((a) => ymd(new Date(a.startAt)) === ymd(day));
                const isToday = ymd(day) === ymd(new Date());
                return (
                  <div key={ymd(day)} className="relative flex-1 border-l border-[#F1F5F9] last:border-l-0">
                    <div className={`sticky top-0 z-10 h-10 border-b border-[#EEF1F4] px-2 py-1 text-center text-xs font-bold ${isToday ? "bg-[#F1FBFA] text-[#0F8B94]" : "bg-white text-[#475569]"}`}>
                      {view === "week" ? `${AR_DAYS[day.getDay()]} ${day.getDate()}` : "المواعيد"}
                    </div>
                    <div className="relative" style={{ height: (DAY_END - DAY_START) * 60 * PX_PER_MIN }}>
                      {hours.map((h) => <div key={h} className="border-b border-[#F5F7FA]" style={{ height: 60 * PX_PER_MIN }} />)}
                      {dayAppts.map((a) => {
                        const s = new Date(a.startAt);
                        const startMin = s.getHours() * 60 + s.getMinutes();
                        const top = (startMin - DAY_START * 60) * PX_PER_MIN;
                        const height = Math.max(a.durationMin * PX_PER_MIN, 22);
                        const color = APPOINTMENT_STATUS_MAP[a.status]?.color || "bg-slate-100 text-slate-600";
                        return (
                          <button key={a.id} onClick={() => setSelected(a)} style={{ top, height }} className={`absolute inset-x-1 overflow-hidden rounded-lg border border-black/5 px-2 py-1 text-right text-[11px] shadow-sm ${color}`}>
                            <p className="truncate font-bold">{s.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })} {a.patientName}</p>
                            {height > 30 && <p className="truncate opacity-80">{[a.treatmentType, a.doctorName, a.room].filter(Boolean).join(" · ")}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected && <ApptPanel appt={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load(); }} onOpenPatient={onOpenPatient} />}
      {creating && <NewAppointmentModal initialDate={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); }} />}
    </div>
  );
}

function ApptPanel({ appt, onClose, onChanged, onOpenPatient }: { appt: Appt; onClose: () => void; onChanged: () => void; onOpenPatient: (id: number, tab?: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    if (busy) return;
    setBusy(true);
    const r = await apiFetch(`/api/dental/appointments/${appt.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setBusy(false);
    if (r.ok) { toast.success("تم تحديث حالة الموعد"); onChanged(); }
    else toast.error(r.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1F2937]">{appt.patientName}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9]"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1 text-sm text-[#475569]">
          <p><span className="text-[#94A3B8]">الوقت: </span>{fmtDateTime(appt.startAt)}</p>
          {appt.treatmentType && <p><span className="text-[#94A3B8]">العلاج: </span>{appt.treatmentType}</p>}
          {appt.doctorName && <p><span className="text-[#94A3B8]">الطبيب: </span>{appt.doctorName}</p>}
          {appt.room && <p><span className="text-[#94A3B8]">الغرفة: </span>{appt.room}</p>}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">الحالة</label>
          <select value={appt.status} onChange={(e) => setStatus(e.target.value)} disabled={busy} className={INP}>
            {APPOINTMENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2">
          <button onClick={() => onOpenPatient(appt.patientId, "overview")} className="rounded-xl bg-[#0F8B94] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0B6E75]">فتح الملف</button>
          <button onClick={() => onOpenPatient(appt.patientId, "billing")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#F8FAFC] px-3 py-2.5 text-sm font-bold text-[#475569] hover:bg-[#EEF2F6]"><Wallet className="h-4 w-4" /> دفع</button>
          <button onClick={() => setStatus("cancelled")} disabled={busy} className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60">إلغاء الموعد</button>
        </div>
      </div>
    </div>
  );
}

type ClinicOptions = { doctors: string[]; rooms: string[]; treatments: { id: number; name: string; defaultPrice: number }[] };

function NewAppointmentModal({ initialDate, onClose, onCreated }: { initialDate: Date; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [options, setOptions] = useState<ClinicOptions>({ doctors: [], rooms: [], treatments: [] });
  const [form, setForm] = useState({ patientId: "", treatmentType: "", doctorName: "", startAt: toLocalInput(initialDate), durationMin: "30", room: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  useEffect(() => {
    apiFetch<{ patients: PatientRow[] }>("/api/dental/patients").then((r) => { if (r.ok) setPatients(r.data.patients || []); });
    apiFetch<ClinicOptions>("/api/dental/clinic-options").then((r) => { if (r.ok) setOptions(r.data); });
  }, []);

  async function submit(override = false) {
    setErr("");
    if (!form.patientId || !form.startAt) { setErr("المريض والوقت مطلوبان"); return; }
    if (busy) return;
    setBusy(true);
    setConflicts(null);
    const r = await apiFetch<unknown>("/api/dental/appointments", {
      method: "POST",
      body: JSON.stringify({ ...form, patientId: Number(form.patientId), startAt: new Date(form.startAt).toISOString(), durationMin: Number(form.durationMin) || 30, override }),
    });
    setBusy(false);
    if (r.ok) { toast.success("تم حجز الموعد"); onCreated(); return; }
    if (r.status === 409) { setConflicts(((r.body as { conflicts?: Conflict[] })?.conflicts) || []); return; }
    setErr(r.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1F2937]">موعد جديد</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9]"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className={`${INP} md:col-span-2`}>
            <option value="">اختر المريض</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.patientNumber}</option>)}
          </select>
          <select value={form.treatmentType} onChange={(e) => setForm({ ...form, treatmentType: e.target.value })} className={INP}>
            <option value="">نوع العلاج</option>
            {options.treatments.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <select value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} className={INP}>
            <option value="">الطبيب</option>
            {options.doctors.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className={INP} />
          <input value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="المدة (دقيقة)" className={INP} inputMode="numeric" />
          <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={`${INP} md:col-span-2`}>
            <option value="">الغرفة</option>
            {options.rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {conflicts && conflicts.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-bold">يوجد تعارض:</p>
            {conflicts.map((c) => <p key={c.id}>{c.patientName} — {fmtDateTime(c.startAt)} ({c.doctorName || c.room})</p>)}
            <button onClick={() => submit(true)} className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">احجز رغم التعارض</button>
          </div>
        )}
        {err && <p className="mt-3 text-xs font-semibold text-rose-600">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#64748B]">إلغاء</button>
          <button onClick={() => submit(false)} disabled={busy} className="rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "..." : "حجز الموعد"}</button>
        </div>
      </div>
    </div>
  );
}
