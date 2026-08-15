// Approved-template registry + payload builders (pure, unit-tested).
//
// IMPORTANT: A template can only be *sent* after it has been created AND approved inside the
// Meta WhatsApp Manager for the connected WABA. This registry only describes the templates the
// CRM intends to use and the variables it will pass; it does NOT create/approve anything.

export type WaTemplateVar = { key: string; label: string; example: string };

export type WaTemplateDef = {
  name: string; // must match the template name approved in Meta exactly
  label: string; // human label for the CRM UI
  description: string;
  category: "utility" | "marketing";
  defaultLanguage: string; // e.g. "ar" / "en_US"
  variables: WaTemplateVar[]; // ordered {{1}}, {{2}}, ...
};

export const WHATSAPP_TEMPLATES: WaTemplateDef[] = [
  {
    name: "appointment_reminder",
    label: "تذكير بموعد",
    description: "تذكير المريض بموعده القادم.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [
      { key: "patientName", label: "اسم المريض", example: "أحمد" },
      { key: "date", label: "التاريخ", example: "2026-08-20" },
      { key: "time", label: "الوقت", example: "10:30" },
    ],
  },
  {
    name: "appointment_confirmation",
    label: "تأكيد موعد",
    description: "تأكيد حجز موعد للمريض.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [
      { key: "patientName", label: "اسم المريض", example: "أحمد" },
      { key: "date", label: "التاريخ", example: "2026-08-20" },
      { key: "time", label: "الوقت", example: "10:30" },
    ],
  },
  {
    name: "appointment_cancellation",
    label: "إلغاء موعد",
    description: "إشعار المريض بإلغاء موعده.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [{ key: "patientName", label: "اسم المريض", example: "أحمد" }],
  },
  {
    name: "follow_up",
    label: "متابعة",
    description: "رسالة متابعة عامة بعد الزيارة.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [{ key: "patientName", label: "اسم المريض", example: "أحمد" }],
  },
  {
    name: "payment_reminder",
    label: "تذكير دفعة",
    description: "تذكير المريض برصيد مستحق.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [
      { key: "patientName", label: "اسم المريض", example: "أحمد" },
      { key: "amount", label: "المبلغ", example: "₪500" },
    ],
  },
  {
    name: "treatment_follow_up",
    label: "متابعة علاج",
    description: "متابعة بعد جلسة علاج.",
    category: "utility",
    defaultLanguage: "ar",
    variables: [{ key: "patientName", label: "اسم المريض", example: "أحمد" }],
  },
];

export function findTemplate(name: string): WaTemplateDef | null {
  return WHATSAPP_TEMPLATES.find((t) => t.name === name) || null;
}

/**
 * Build the Cloud API `template` message payload.
 * `params` are the ordered body variables ({{1}}, {{2}}, ...).
 */
export function buildTemplatePayload(
  to: string,
  name: string,
  languageCode: string,
  params: string[]
): Record<string, unknown> {
  const components =
    params.length > 0
      ? [
          {
            type: "body",
            parameters: params.map((text) => ({ type: "text", text: String(text ?? "") })),
          },
        ]
      : [];
  return {
    to,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  };
}

/** Build a plain text message payload. */
export function buildTextPayload(to: string, body: string): Record<string, unknown> {
  return { to, type: "text", text: { preview_url: false, body } };
}
