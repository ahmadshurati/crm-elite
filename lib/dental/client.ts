import { statusToMessage } from "@/lib/dental/format";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; body?: unknown };

const DEFAULT_TIMEOUT = 20000;

/**
 * Resilient fetch wrapper used by every dental client request.
 * - never throws (network/timeout/parse errors become { ok:false })
 * - enforces a timeout via AbortController
 * - parses JSON safely and surfaces a server `error` message when present
 * - redirects to /login on 401 (session expiry)
 */
export async function apiFetch<T = unknown>(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<ApiResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT, headers, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  if (init.body && typeof init.body === "string" && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, { cache: "no-store", ...init, headers: finalHeaders, signal: controller.signal });

    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      return { ok: false, status: 401, error: statusToMessage(401) };
    }

    if (!res.ok) {
      const serverMsg = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "";
      return { ok: false, status: res.status, error: serverMsg || statusToMessage(res.status), body };
    }

    return { ok: true, status: res.status, data: (body ?? ({} as T)) as T };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? "انتهت مهلة الطلب. تحقّق من الاتصال وحاول مجددًا." : statusToMessage(0),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience POST/PATCH/DELETE with a JSON body. */
export function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  opts: { timeoutMs?: number } = {}
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    timeoutMs: opts.timeoutMs,
  });
}
