// Phone normalization for WhatsApp (pure, unit-tested). No external deps.
// WhatsApp Cloud API expects the recipient as digits in international E.164 form WITHOUT a leading "+".

/**
 * Normalize an arbitrary local/international phone string to WhatsApp digits (E.164 without "+").
 * `defaultCountry` is the clinic's country calling code (digits, e.g. "972"), used only when the
 * input is clearly a local/national number. Returns null when the value can't be a real number.
 *
 * Examples (defaultCountry="972"):
 *   "05x xxx xxxx"      -> "9725xxxxxxx"
 *   "+972 5x-xxx-xxxx"  -> "9725xxxxxxx"
 *   "00972 5xxxxxxxx"   -> "9725xxxxxxx"
 *   "9725xxxxxxx"       -> "9725xxxxxxx"
 */
export function normalizePhone(raw: unknown, defaultCountry = "972"): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const hadPlus = s.startsWith("+");
  // Keep only digits
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  const cc = String(defaultCountry).replace(/\D/g, "") || "972";

  if (hadPlus) {
    // Already international (the "+" told us so) — trust the digits as-is.
    return digits.length >= 8 ? digits : null;
  }

  // "00" international prefix -> drop it
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 ? digits : null;
  }

  // Local number with leading 0 (e.g. 05xxxxxxxx) -> replace 0 with country code
  if (digits.startsWith("0")) {
    return cc + digits.slice(1);
  }

  // Already starts with the country code
  if (digits.startsWith(cc)) {
    return digits.length >= 8 ? digits : null;
  }

  // A bare national number (no leading 0, no country code) -> prepend country code
  if (digits.length <= 10) {
    return cc + digits;
  }

  // Otherwise assume it's already international
  return digits.length >= 8 ? digits : null;
}

/** Display form with a leading "+". */
export function displayPhone(normalized: string | null): string {
  if (!normalized) return "—";
  return `+${normalized}`;
}

/**
 * A stable matching key = the last 9 digits (subscriber number) of a normalized number.
 * Used to match an inbound WhatsApp sender to a patient regardless of how the patient's
 * phone was typed/stored. Returns "" when there aren't enough digits (never matches).
 */
export function phoneMatchKey(normalized: string | null): string {
  if (!normalized) return "";
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8) return "";
  return digits.slice(-9);
}
