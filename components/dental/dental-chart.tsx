"use client";

import { useState } from "react";
import { CONDITION_MAP, QUADRANTS, TOOTH_CONDITIONS } from "@/lib/dental/constants";

type Tooth = { toothNumber: number; condition: string; notes?: string | null };

export function DentalChart({
  patientId,
  teeth,
  onChange,
}: {
  patientId: number;
  teeth: Tooth[];
  onChange: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const map = new Map(teeth.map((t) => [t.toothNumber, t.condition]));

  async function setCondition(toothNumber: number, condition: string) {
    setSaving(true);
    try {
      await fetch(`/api/dental/patients/${patientId}/teeth`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toothNumber, condition }),
      });
      onChange();
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  function ToothBtn({ n }: { n: number }) {
    const cond = map.get(n) || "healthy";
    const color = CONDITION_MAP[cond]?.color || "#E5E7EB";
    const active = selected === n;
    return (
      <button
        type="button"
        onClick={() => setSelected(active ? null : n)}
        className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition ${active ? "ring-2 ring-[#0F8B94]" : "hover:bg-[#F1FBFA]"}`}
        title={`سن ${n} — ${CONDITION_MAP[cond]?.label || ""}`}
      >
        <span
          className="flex h-8 w-7 items-center justify-center rounded-md border border-black/10 text-[10px] font-bold text-[#1F2937]"
          style={{ backgroundColor: color }}
        >
          {n}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#EAECEF] bg-white p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {QUADRANTS.map((q) => (
            <div key={q.id}>
              <p className="mb-2 text-center text-[11px] font-bold text-[#94A3B8]">{q.label}</p>
              <div className="flex flex-wrap justify-center gap-0.5">
                {q.teeth.map((n) => (
                  <ToothBtn key={n} n={n} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected != null && (
        <div className="rounded-2xl border border-[#0F8B94]/30 bg-[#F1FBFA] p-4">
          <p className="mb-3 text-sm font-bold text-[#0F8B94]">حالة السن رقم {selected}</p>
          <div className="flex flex-wrap gap-2">
            {TOOTH_CONDITIONS.map((c) => (
              <button
                key={c.id}
                disabled={saving}
                onClick={() => setCondition(selected, c.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-bold text-[#334155] hover:border-[#0F8B94] disabled:opacity-50"
              >
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TOOTH_CONDITIONS.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] ring-1 ring-[#EAECEF]">
            <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
