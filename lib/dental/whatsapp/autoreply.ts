// Auto-reply (menu with options) logic — pure helpers, unit-tested.
// Fires when a patient messages the clinic and keeps replying (with a cooldown) UNTIL a human
// agent replies in that conversation. Sent as a WhatsApp interactive "buttons" message, which is
// allowed because an inbound message opens the 24-hour customer-service window.

export const DEFAULT_AUTO_REPLY_TEXT =
  "أهلاً بك في عيادة الأسنان 🦷\nكيف يمكننا مساعدتك؟ اختر من الخيارات التالية وسيتواصل معك أحد المندوبين قريبًا.";

export const DEFAULT_AUTO_REPLY_OPTIONS = ["حجز موعد", "مواعيد وأسعار", "التحدث مع مندوب"];

export const DEFAULT_AUTO_REPLY_COOLDOWN_MIN = 120;

export type AutoReplyDecision = {
  enabled: boolean;
  hasHumanReply: boolean; // an agent already replied -> stop auto-replying
  lastAutoReplyAt: Date | string | null;
  cooldownMin: number;
  now?: number;
};

/** Should the bot send (another) auto-reply for a just-received inbound message? */
export function shouldAutoReply(input: AutoReplyDecision): boolean {
  if (!input.enabled) return false;
  if (input.hasHumanReply) return false; // a representative has taken over
  if (input.lastAutoReplyAt) {
    const t = new Date(input.lastAutoReplyAt).getTime();
    const now = input.now ?? Date.now();
    const cooldownMs = Math.max(0, input.cooldownMin) * 60 * 1000;
    if (Number.isFinite(t) && now - t < cooldownMs) return false; // still within cooldown
  }
  return true;
}

/** Normalize option labels: trim, drop empties, cap to 3 (WhatsApp limit), 20 chars each. */
export function normalizeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => String(o ?? "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((o) => o.slice(0, 20));
}

/** Build the Cloud API interactive "button" payload (max 3 reply buttons). */
export function buildButtonsPayload(to: string, bodyText: string, options: string[]): Record<string, unknown> {
  const buttons = normalizeOptions(options).map((title, i) => ({
    type: "reply",
    reply: { id: `opt_${i + 1}`, title },
  }));
  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: String(bodyText || "").slice(0, 1024) },
      action: { buttons },
    },
  };
}

/** A plain-text rendering of the menu, stored on the outbound message so staff see what was sent. */
export function autoReplyStoredBody(bodyText: string, options: string[]): string {
  const opts = normalizeOptions(options);
  if (opts.length === 0) return bodyText;
  return [bodyText, ...opts.map((o, i) => `${i + 1}. ${o}`)].join("\n");
}
