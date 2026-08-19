"use client";

import { Loader2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AUTOMATION_API_URL } from "@/lib/crm/constants";
import type { AutomationRuleRecord } from "@/lib/crm/automation";

const triggerLabels: Record<string, string> = {
  quote_approved: "موافقة على عرض سعر",
  deal_won: "فوز بصفقة",
  insurance_expiring: "تأمين ينتهي قريباً",
};

export function AutomationDashboard({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<AutomationRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(AUTOMATION_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setRules(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function toggleRule(rule: AutomationRuleRecord) {
    if (!canEdit) return;
    await fetch(AUTOMATION_API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, isEnabled: !rule.isEnabled }),
    });
    await loadRules();
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <h3 className="text-[22px] font-bold text-[#1F2937]">الأتمتة والتذكيرات</h3>
        <p className="mt-1 text-sm text-[#707A84]">
          قواعد تلقائية لإنشاء مهام متابعة عند موافقة عرض سعر، فوز صفقة، أو اقتراب انتهاء تأمين
        </p>
      </div>

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-[#EFF4FF] p-2 text-[#2563EB]">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#1F2937]">{rule.name}</p>
                    <p className="mt-1 text-xs text-[#707A84]">
                      المحفّز: {triggerLabels[rule.triggerType] || rule.triggerType} — الإجراء: {rule.actionType}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggleRule(rule)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                      rule.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {rule.isEnabled ? "مفعّل" : "معطّل"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export type { AutomationRuleRecord };