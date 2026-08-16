// Dental WhatsApp service layer: conversations, sending, patient matching, webhook ingestion.
// Everything is scoped by companyId. This is the only module that mutates WhatsApp tables.

import { query, queryOne, execute } from "@/lib/db";
import { safeIso } from "@/lib/dental/format";
import { writeDentalAudit } from "@/lib/dental/services/audit";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import type { DentalContext } from "@/lib/dental/data";
import { getConfig, getCompanyIdByPhoneNumberId, isWithinServiceWindow, defaultCountryCode, type WaConfig } from "./config";
import { graphSend } from "./client";
import { normalizePhone, phoneMatchKey } from "./phone";
import { buildTextPayload, buildTemplatePayload, findTemplate } from "./templates";
import { extractChanges } from "./webhook";
import {
  shouldAutoReply,
  buildButtonsPayload,
  autoReplyStoredBody,
  DEFAULT_AUTO_REPLY_TEXT,
  DEFAULT_AUTO_REPLY_OPTIONS,
} from "./autoreply";
import { shouldApplyStatus, isWaStatus, type WaConversation, type WaMessage, type WaStatus, type WaType } from "./types";

const MAX_TEXT_LEN = 4096;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type ConvRow = {
  id: number;
  patientId: number | null;
  phone: string;
  waName: string | null;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastInboundAt: Date | null;
  unreadCount: number;
  status: string;
  patientName?: string | null;
};

function mapConversation(r: ConvRow): WaConversation {
  return {
    id: r.id,
    patientId: r.patientId,
    patientName: r.patientName ?? null,
    phone: r.phone,
    waName: r.waName,
    lastMessageText: r.lastMessageText,
    lastMessageAt: safeIso(r.lastMessageAt),
    lastInboundAt: safeIso(r.lastInboundAt),
    unreadCount: Number(r.unreadCount || 0),
    status: r.status,
    withinWindow: isWithinServiceWindow(r.lastInboundAt),
  };
}

export async function listConversations(companyId: number, search = ""): Promise<WaConversation[]> {
  const term = `%${search.trim()}%`;
  const hasSearch = search.trim().length > 0;
  const rows = await query<ConvRow>(
    `SELECT c.id, c.patientId, c.phone, c.waName, c.lastMessageText, c.lastMessageAt,
            c.lastInboundAt, c.unreadCount, c.status, p.fullName AS patientName
       FROM DentalWhatsAppConversation c
       LEFT JOIN DentalPatient p ON p.id = c.patientId
      WHERE c.companyId = ?
        ${hasSearch ? "AND (c.phone LIKE ? OR c.waName LIKE ? OR p.fullName LIKE ?)" : ""}
      ORDER BY (c.lastMessageAt IS NULL), c.lastMessageAt DESC
      LIMIT 200`,
    hasSearch ? [companyId, term, term, term] : [companyId]
  );
  return rows.map(mapConversation);
}

export async function getConversation(companyId: number, id: number): Promise<WaConversation | null> {
  const row = await queryOne<ConvRow>(
    `SELECT c.id, c.patientId, c.phone, c.waName, c.lastMessageText, c.lastMessageAt,
            c.lastInboundAt, c.unreadCount, c.status, p.fullName AS patientName
       FROM DentalWhatsAppConversation c
       LEFT JOIN DentalPatient p ON p.id = c.patientId
      WHERE c.id = ? AND c.companyId = ? LIMIT 1`,
    [id, companyId]
  );
  return row ? mapConversation(row) : null;
}

type MsgRow = {
  id: number;
  wamid: string | null;
  direction: string;
  type: string;
  body: string | null;
  mediaUrl: string | null;
  templateName: string | null;
  status: string;
  errorMessage: string | null;
  contextWamid: string | null;
  timestamp: Date | null;
};

export async function getMessages(companyId: number, conversationId: number): Promise<WaMessage[] | null> {
  const conv = await getConversation(companyId, conversationId);
  if (!conv) return null;
  const rows = await query<MsgRow>(
    `SELECT id, wamid, direction, type, body, mediaUrl, templateName, status, errorMessage, contextWamid, timestamp
       FROM DentalWhatsAppMessage
      WHERE conversationId = ? AND companyId = ?
      ORDER BY timestamp ASC, id ASC
      LIMIT 500`,
    [conversationId, companyId]
  );
  return rows.map((r) => ({
    id: r.id,
    wamid: r.wamid,
    direction: r.direction === "inbound" ? "inbound" : "outbound",
    type: (r.type || "text") as WaType,
    body: r.body,
    mediaUrl: r.mediaUrl,
    templateName: r.templateName,
    status: (isWaStatus(r.status) ? r.status : "sent") as WaStatus,
    errorMessage: r.errorMessage,
    contextWamid: r.contextWamid,
    timestamp: safeIso(r.timestamp),
  }));
}

export async function markConversationRead(companyId: number, conversationId: number): Promise<boolean> {
  const res = await execute(
    "UPDATE DentalWhatsAppConversation SET unreadCount = 0, updatedAt = NOW(3) WHERE id = ? AND companyId = ?",
    [conversationId, companyId]
  );
  return res.affectedRows > 0;
}

export async function getPatientSummary(companyId: number, patientId: number) {
  const row = await queryOne<ConvRow>(
    `SELECT id, patientId, phone, waName, lastMessageText, lastMessageAt, lastInboundAt, unreadCount, status
       FROM DentalWhatsAppConversation
      WHERE companyId = ? AND patientId = ?
      ORDER BY lastMessageAt DESC LIMIT 1`,
    [companyId, patientId]
  );
  if (!row) return { conversationId: null, lastMessageText: null, lastMessageAt: null, unreadCount: 0, withinWindow: false };
  return {
    conversationId: row.id,
    lastMessageText: row.lastMessageText,
    lastMessageAt: safeIso(row.lastMessageAt),
    unreadCount: Number(row.unreadCount || 0),
    withinWindow: isWithinServiceWindow(row.lastInboundAt),
  };
}

// ---------------------------------------------------------------------------
// Patient matching (same company only) + conversation upsert
// ---------------------------------------------------------------------------

async function matchPatient(
  companyId: number,
  normalizedPhone: string
): Promise<{ patientId: number; patientName: string } | null> {
  const key = phoneMatchKey(normalizedPhone);
  if (!key) return null;
  const like = `%${key}%`;
  const rows = await query<{ id: number; fullName: string }>(
    `SELECT id, fullName FROM DentalPatient
      WHERE companyId = ? AND deletedAt IS NULL AND (phone LIKE ? OR whatsapp LIKE ?)
      LIMIT 3`,
    [companyId, like, like]
  );
  if (rows.length === 1) return { patientId: rows[0].id, patientName: rows[0].fullName };
  return null; // 0 or ambiguous (>1) -> leave unlinked, never guess across records
}

async function findOrCreateConversation(
  companyId: number,
  normalizedPhone: string,
  waName: string | null,
  patientId: number | null
): Promise<number> {
  const existing = await queryOne<{ id: number; patientId: number | null }>(
    "SELECT id, patientId FROM DentalWhatsAppConversation WHERE companyId = ? AND phone = ? LIMIT 1",
    [companyId, normalizedPhone]
  );
  if (existing) {
    // Backfill patient link / name if we learned something new.
    if ((patientId && !existing.patientId) || waName) {
      await execute(
        `UPDATE DentalWhatsAppConversation
            SET patientId = COALESCE(patientId, ?), waName = COALESCE(waName, ?), updatedAt = NOW(3)
          WHERE id = ?`,
        [patientId, waName, existing.id]
      );
    }
    return existing.id;
  }
  const res = await execute(
    `INSERT INTO DentalWhatsAppConversation (companyId, patientId, phone, waName, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'open', NOW(3), NOW(3))`,
    [companyId, patientId, normalizedPhone, waName]
  );
  return res.insertId;
}

/** Open (or create) the conversation for a patient, from the patient profile "WhatsApp" action. */
export async function ensureConversationForPatient(
  ctx: DentalContext,
  patientId: number
): Promise<{ ok: true; conversationId: number } | { ok: false; error: string }> {
  const patient = await queryOne<{ id: number; fullName: string; phone: string | null; whatsapp: string | null }>(
    "SELECT id, fullName, phone, whatsapp FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
    [patientId, ctx.companyId]
  );
  if (!patient) return { ok: false, error: "المريض غير موجود" };
  const config = await getConfig(ctx.companyId);
  const country = config?.defaultCountry || defaultCountryCode();
  const normalized = normalizePhone(patient.whatsapp || patient.phone, country);
  if (!normalized) return { ok: false, error: "لا يوجد رقم واتساب/هاتف صالح لهذا المريض" };
  const conversationId = await findOrCreateConversation(ctx.companyId, normalized, patient.fullName, patient.id);
  return { ok: true, conversationId };
}

export async function linkConversation(
  ctx: DentalContext,
  conversationId: number,
  patientId: number | null
): Promise<{ ok: boolean; error?: string }> {
  const conv = await getConversation(ctx.companyId, conversationId);
  if (!conv) return { ok: false, error: "المحادثة غير موجودة" };
  if (patientId != null) {
    const patient = await queryOne<{ id: number }>(
      "SELECT id FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
      [patientId, ctx.companyId]
    );
    if (!patient) return { ok: false, error: "المريض غير موجود" };
  }
  await execute(
    "UPDATE DentalWhatsAppConversation SET patientId = ?, updatedAt = NOW(3) WHERE id = ? AND companyId = ?",
    [patientId, conversationId, ctx.companyId]
  );
  // Propagate to messages so patient timelines stay coherent.
  await execute("UPDATE DentalWhatsAppMessage SET patientId = ? WHERE conversationId = ? AND companyId = ?", [
    patientId,
    conversationId,
    ctx.companyId,
  ]);
  await writeDentalAudit({
    companyId: ctx.companyId,
    userId: ctx.userId,
    username: ctx.username,
    action: patientId != null ? "link" : "unlink",
    entityType: "whatsappConversation",
    entityId: conversationId,
    newValues: { patientId },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type SendInput =
  | { type: "text"; body: string }
  | { type: "template"; templateName: string; templateLanguage?: string; templateParams?: string[] };

export type SendResult =
  | { ok: true; message: WaMessage; conversationId: number }
  | { ok: false; code: "not_configured" | "window_closed" | "invalid" | "meta_error"; error: string };

export async function sendMessage(
  ctx: DentalContext,
  conversationId: number,
  input: SendInput
): Promise<SendResult> {
  const conv = await getConversation(ctx.companyId, conversationId);
  if (!conv) return { ok: false, code: "invalid", error: "المحادثة غير موجودة" };

  const config = await getConfig(ctx.companyId);
  if (!config) return { ok: false, code: "not_configured", error: "WhatsApp غير مُهيّأ لهذه العيادة" };

  const to = conv.phone; // already normalized digits

  let payload: Record<string, unknown>;
  let type: WaType;
  let bodyForStore: string | null;
  let templateName: string | null = null;

  if (input.type === "template") {
    const def = findTemplate(input.templateName);
    if (!def) return { ok: false, code: "invalid", error: "قالب غير معروف" };
    const params = Array.isArray(input.templateParams) ? input.templateParams.map((p) => String(p ?? "")) : [];
    const lang = input.templateLanguage || def.defaultLanguage;
    payload = buildTemplatePayload(to, def.name, lang, params);
    type = "template";
    templateName = def.name;
    bodyForStore = `[قالب: ${def.label}]${params.length ? " " + params.join(" · ") : ""}`;
  } else {
    const body = String(input.body || "").trim();
    if (!body) return { ok: false, code: "invalid", error: "نص الرسالة فارغ" };
    if (body.length > MAX_TEXT_LEN) return { ok: false, code: "invalid", error: "الرسالة طويلة جدًا" };
    // 24-hour customer-service window applies to free-form text only.
    if (!conv.withinWindow) {
      return {
        ok: false,
        code: "window_closed",
        error: "انتهت نافذة 24 ساعة للرسائل الحرة. استخدم قالبًا معتمدًا للتواصل مع المريض.",
      };
    }
    payload = buildTextPayload(to, body);
    type = "text";
    bodyForStore = body;
  }

  const result = await graphSend(config, payload);

  // Persist the message either way so the thread reflects reality (incl. failures).
  const status: WaStatus = result.ok ? "sent" : "failed";
  const wamid = result.ok ? result.wamid : null;
  const errorCode = result.ok ? null : result.errorCode;
  const errorMessage = result.ok ? null : result.error;

  const ins = await execute(
    `INSERT INTO DentalWhatsAppMessage
       (companyId, conversationId, patientId, wamid, direction, type, body, templateName, status, errorCode, errorMessage, sentByUserId, timestamp, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
    [
      ctx.companyId,
      conversationId,
      conv.patientId,
      wamid,
      type,
      bodyForStore,
      templateName,
      status,
      errorCode,
      errorMessage,
      ctx.userId,
    ]
  );

  await execute(
    `UPDATE DentalWhatsAppConversation
        SET lastMessageText = ?, lastMessageAt = NOW(3), updatedAt = NOW(3)
      WHERE id = ? AND companyId = ?`,
    [bodyForStore?.slice(0, 500) ?? null, conversationId, ctx.companyId]
  );

  // Audit + patient timeline (best-effort; never blocks the send result).
  try {
    await writeDentalAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      username: ctx.username,
      action: "send",
      entityType: "whatsappMessage",
      entityId: ins.insertId,
      newValues: { type, status, templateName: templateName || undefined },
    });
    if (conv.patientId) {
      await addTimelineEvent({
        companyId: ctx.companyId,
        patientId: conv.patientId,
        type: "message",
        title: result.ok ? "أُرسلت رسالة واتساب" : "فشل إرسال رسالة واتساب",
        actorName: ctx.username,
      });
    }
  } catch (e) {
    console.error("whatsapp audit/timeline failed", e);
  }

  if (!result.ok) {
    return { ok: false, code: "meta_error", error: result.error };
  }

  const message: WaMessage = {
    id: ins.insertId,
    wamid,
    direction: "outbound",
    type,
    body: bodyForStore,
    mediaUrl: null,
    templateName,
    status,
    errorMessage: null,
    contextWamid: null,
    timestamp: new Date().toISOString(),
  };
  return { ok: true, message, conversationId };
}

// ---------------------------------------------------------------------------
// Webhook ingestion (idempotent)
// ---------------------------------------------------------------------------

function inboundDisplayBody(text: string | null, type: WaType): string | null {
  if (text) return text;
  const labels: Partial<Record<WaType, string>> = {
    image: "[صورة]",
    document: "[مستند]",
    audio: "[رسالة صوتية]",
    video: "[فيديو]",
    location: "[موقع]",
  };
  return labels[type] || null;
}

/**
 * Auto-reply (menu with options) — sent when a patient messages the clinic, and kept up until a
 * human agent replies. An inbound message opens the 24h window, so an interactive message is allowed.
 */
async function maybeAutoReply(
  config: WaConfig,
  conversationId: number,
  to: string,
  patientId: number | null
): Promise<void> {
  if (!config.autoReplyEnabled) return;

  // A representative (human) already replied -> stop auto-replying.
  const human = await queryOne<{ id: number }>(
    "SELECT id FROM DentalWhatsAppMessage WHERE conversationId = ? AND companyId = ? AND direction = 'outbound' AND sentByUserId IS NOT NULL LIMIT 1",
    [conversationId, config.companyId]
  );
  const hasHumanReply = !!human;

  // Cooldown is measured from the last automated (system) outbound.
  const last = await queryOne<{ ts: Date | null }>(
    "SELECT MAX(timestamp) AS ts FROM DentalWhatsAppMessage WHERE conversationId = ? AND companyId = ? AND direction = 'outbound' AND sentByUserId IS NULL",
    [conversationId, config.companyId]
  );

  if (!shouldAutoReply({ enabled: true, hasHumanReply, lastAutoReplyAt: last?.ts ?? null, cooldownMin: config.autoReplyCooldownMin })) {
    return;
  }

  const text = config.autoReplyText || DEFAULT_AUTO_REPLY_TEXT;
  const options = config.autoReplyOptions.length ? config.autoReplyOptions : DEFAULT_AUTO_REPLY_OPTIONS;
  const result = await graphSend(config, buildButtonsPayload(to, text, options));

  const storedBody = autoReplyStoredBody(text, options);
  await execute(
    `INSERT INTO DentalWhatsAppMessage
       (companyId, conversationId, patientId, wamid, direction, type, body, status, errorCode, errorMessage, sentByUserId, timestamp, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'outbound', 'interactive', ?, ?, ?, ?, NULL, NOW(3), NOW(3), NOW(3))`,
    [
      config.companyId,
      conversationId,
      patientId,
      result.ok ? result.wamid : null,
      storedBody,
      result.ok ? "sent" : "failed",
      result.ok ? null : result.errorCode,
      result.ok ? null : result.error,
    ]
  );
  await execute(
    "UPDATE DentalWhatsAppConversation SET lastMessageText = ?, lastMessageAt = NOW(3), updatedAt = NOW(3) WHERE id = ? AND companyId = ?",
    [storedBody.slice(0, 500), conversationId, config.companyId]
  );
}

/** Ingest a verified webhook payload. Idempotent by wamid. Returns count of processed items. */
export async function ingestWebhook(payload: unknown): Promise<{ inbound: number; statuses: number }> {
  const changes = extractChanges(payload);
  let inboundCount = 0;
  let statusCount = 0;

  for (const change of changes) {
    if (!change.phoneNumberId) continue;
    const companyId = await getCompanyIdByPhoneNumberId(change.phoneNumberId);
    if (!companyId) {
      console.warn("whatsapp webhook: no dental company for phone_number_id");
      continue;
    }
    const config = await getConfig(companyId);
    const country = config?.defaultCountry || defaultCountryCode();

    for (const m of change.inbound) {
      // Idempotency guard (wamid is globally unique).
      const exists = await queryOne<{ id: number }>(
        "SELECT id FROM DentalWhatsAppMessage WHERE wamid = ? LIMIT 1",
        [m.wamid]
      );
      if (exists) continue;

      const normalized = normalizePhone(m.from, country) || m.from.replace(/\D/g, "");
      const matched = await matchPatient(companyId, normalized);
      const conversationId = await findOrCreateConversation(
        companyId,
        normalized,
        m.name,
        matched?.patientId ?? null
      );
      const body = inboundDisplayBody(m.text, m.type);
      try {
        await execute(
          `INSERT INTO DentalWhatsAppMessage
             (companyId, conversationId, patientId, wamid, direction, type, body, status, contextWamid, timestamp, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'inbound', ?, ?, 'delivered', ?, ?, NOW(3), NOW(3))`,
          [companyId, conversationId, matched?.patientId ?? null, m.wamid, m.type, body, m.contextWamid, m.timestamp]
        );
      } catch (e: unknown) {
        // Duplicate delivery race -> unique(wamid) rejects; treat as already processed.
        if (e && typeof e === "object" && (e as { code?: string }).code === "ER_DUP_ENTRY") continue;
        throw e;
      }
      await execute(
        `UPDATE DentalWhatsAppConversation
            SET lastMessageText = ?, lastMessageAt = ?, lastInboundAt = ?, unreadCount = unreadCount + 1,
                waName = COALESCE(waName, ?), updatedAt = NOW(3)
          WHERE id = ? AND companyId = ?`,
        [body?.slice(0, 500) ?? null, m.timestamp, m.timestamp, m.name, conversationId, companyId]
      );
      inboundCount++;

      // Best-effort auto-reply (never blocks webhook processing).
      if (config) {
        try {
          await maybeAutoReply(config, conversationId, normalized, matched?.patientId ?? null);
        } catch (e) {
          console.error("whatsapp auto-reply failed", e);
        }
      }
    }

    for (const s of change.statuses) {
      if (!isWaStatus(s.status)) continue;
      const row = await queryOne<{ id: number; status: string }>(
        "SELECT id, status FROM DentalWhatsAppMessage WHERE wamid = ? AND companyId = ? LIMIT 1",
        [s.wamid, companyId]
      );
      if (!row) continue;
      const current = (isWaStatus(row.status) ? row.status : "sent") as WaStatus;
      if (!shouldApplyStatus(current, s.status)) continue;
      await execute(
        `UPDATE DentalWhatsAppMessage
            SET status = ?, errorCode = COALESCE(?, errorCode), errorMessage = COALESCE(?, errorMessage), updatedAt = NOW(3)
          WHERE id = ?`,
        [s.status, s.errorCode, s.errorMessage, row.id]
      );
      statusCount++;
    }
  }

  return { inbound: inboundCount, statuses: statusCount };
}
