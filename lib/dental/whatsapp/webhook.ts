// Webhook signature verification + pure payload extraction (unit-tested).
// No DB access here — see service.ts `ingestWebhook` for persistence.

import crypto from "crypto";
import { mapMetaMessageType, type WaType } from "./types";

/**
 * Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the RAW request body with the app secret).
 * Returns false when the secret/header is missing or the digest doesn't match (timing-safe).
 */
export function verifySignature(
  appSecret: string | null | undefined,
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!appSecret || !signatureHeader) return false;
  const header = String(signatureHeader);
  if (!header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length).trim();
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type ExtractedInbound = {
  wamid: string;
  from: string;
  name: string | null;
  type: WaType;
  text: string | null;
  mediaId: string | null;
  contextWamid: string | null;
  timestamp: Date;
};

export type ExtractedStatus = {
  wamid: string;
  status: string;
  timestamp: Date;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ExtractedChange = {
  phoneNumberId: string | null;
  inbound: ExtractedInbound[];
  statuses: ExtractedStatus[];
};

function tsToDate(ts: unknown): Date {
  const n = Number(ts);
  // Meta sends unix seconds
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000);
  return new Date();
}

function extractText(msg: Record<string, any>, type: WaType): string | null {
  if (type === "text") return msg.text?.body ?? null;
  if (type === "location") {
    const loc = msg.location || {};
    return loc.name || loc.address || `${loc.latitude ?? ""},${loc.longitude ?? ""}` || null;
  }
  // media captions when present
  const media = msg[type] as { caption?: string } | undefined;
  if (media?.caption) return media.caption;
  return null;
}

function extractMediaId(msg: Record<string, any>, type: WaType): string | null {
  const media = msg[type] as { id?: string } | undefined;
  return media?.id ? String(media.id) : null;
}

/** Turn a raw Meta webhook body into a normalized, DB-agnostic shape. Pure & defensive. */
export function extractChanges(payload: unknown): ExtractedChange[] {
  const out: ExtractedChange[] = [];
  const body = payload as { object?: string; entry?: any[] };
  if (!body || !Array.isArray(body.entry)) return out;

  for (const entry of body.entry) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId: string | null = value?.metadata?.phone_number_id
        ? String(value.metadata.phone_number_id)
        : null;

      const contactName: string | null = value?.contacts?.[0]?.profile?.name
        ? String(value.contacts[0].profile.name)
        : null;

      const inbound: ExtractedInbound[] = [];
      for (const msg of value?.messages || []) {
        if (!msg?.id || !msg?.from) continue;
        const type = mapMetaMessageType(msg.type);
        inbound.push({
          wamid: String(msg.id),
          from: String(msg.from),
          name: contactName,
          type,
          text: extractText(msg, type),
          mediaId: extractMediaId(msg, type),
          contextWamid: msg?.context?.id ? String(msg.context.id) : null,
          timestamp: tsToDate(msg.timestamp),
        });
      }

      const statuses: ExtractedStatus[] = [];
      for (const st of value?.statuses || []) {
        if (!st?.id || !st?.status) continue;
        const errArr = st.errors || [];
        const err = Array.isArray(errArr) && errArr.length ? errArr[0] : null;
        statuses.push({
          wamid: String(st.id),
          status: String(st.status).toLowerCase(),
          timestamp: tsToDate(st.timestamp),
          errorCode: err?.code != null ? String(err.code) : null,
          errorMessage: err ? String(err.title || err.message || err.details || "") || null : null,
        });
      }

      if (phoneNumberId || inbound.length || statuses.length) {
        out.push({ phoneNumberId, inbound, statuses });
      }
    }
  }
  return out;
}
