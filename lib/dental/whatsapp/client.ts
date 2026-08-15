// Low-level Meta Graph API client. The ONLY place that talks to graph.facebook.com.
// Never logs the access token; always resolves (never throws) with a typed result.

import type { WaConfig } from "./config";

const GRAPH_VERSION = "v20.0";
const TIMEOUT_MS = 15000;

export type GraphSendResult =
  | { ok: true; wamid: string | null }
  | { ok: false; error: string; errorCode: string | null; status: number };

/** POST a pre-built message payload to the Cloud API. `payload` must already include `to`/`type`. */
export async function graphSend(
  config: WaConfig,
  payload: Record<string, unknown>
): Promise<GraphSendResult> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number | string; error_data?: { details?: string } };
    };
    if (!res.ok) {
      const err = data.error;
      return {
        ok: false,
        error: String(err?.error_data?.details || err?.message || res.statusText || "WhatsApp API error"),
        errorCode: err?.code != null ? String(err.code) : null,
        status: res.status,
      };
    }
    const wamid = data.messages?.[0]?.id ? String(data.messages[0].id) : null;
    return { ok: true, wamid };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "انتهت مهلة الاتصال بخادم WhatsApp" : "تعذّر الاتصال بخادم WhatsApp",
      errorCode: aborted ? "timeout" : "network",
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
