// Shared, framework-agnostic formatting + error-message helpers (unit tested).

/** Human message for an HTTP status (Arabic). status 0 = network/timeout. */
export function statusToMessage(status: number): string {
  switch (status) {
    case 0:
      return "تعذّر الاتصال بالخادم. تحقّق من الإنترنت وحاول مجددًا.";
    case 400:
      return "طلب غير صالح.";
    case 401:
      return "انتهت الجلسة، يرجى تسجيل الدخول من جديد.";
    case 403:
      return "ليست لديك صلاحية لتنفيذ هذه العملية.";
    case 404:
      return "العنصر المطلوب غير موجود.";
    case 409:
      return "يوجد تعارض في العملية.";
    case 422:
      return "البيانات المدخلة غير صحيحة.";
    case 429:
      return "طلبات كثيرة خلال وقت قصير، يرجى المحاولة بعد قليل.";
    default:
      if (status >= 500) return "حدث خطأ في الخادم. حاول لاحقًا.";
      return "حدث خطأ غير متوقع.";
  }
}

/** Consistent currency formatting (shekels, Latin digits + grouping). */
export function fmtMoney(amount: unknown): string {
  const n = Number(amount || 0);
  return `₪ ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/** e.g. ١٥ آب ٢٠٢٦ */
export function fmtDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

/** date + time */
export function fmtDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("ar", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** time only (HH:mm) */
export function fmtTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

/** Convert an ISO/date to the value a <input type="datetime-local"> expects (local tz). */
export function toDateTimeLocal(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
