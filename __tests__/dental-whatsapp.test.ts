import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { normalizePhone, phoneMatchKey, displayPhone } from "@/lib/dental/whatsapp/phone";
import { shouldApplyStatus, mapMetaMessageType, WA_STATUS_RANK } from "@/lib/dental/whatsapp/types";
import { verifySignature, extractChanges } from "@/lib/dental/whatsapp/webhook";
import { buildTextPayload, buildTemplatePayload, findTemplate } from "@/lib/dental/whatsapp/templates";
import { isWithinServiceWindow, serviceWindowHours } from "@/lib/dental/whatsapp/config";

describe("whatsapp phone normalization", () => {
  it("normalizes local, plus, 00 and bare numbers to E.164 digits (default IL/PS 972)", () => {
    expect(normalizePhone("050-123-4567")).toBe("972501234567");
    expect(normalizePhone("+972 50 123 4567")).toBe("972501234567");
    expect(normalizePhone("00972501234567")).toBe("972501234567");
    expect(normalizePhone("972501234567")).toBe("972501234567");
    expect(normalizePhone("501234567")).toBe("972501234567"); // bare national number
  });

  it("respects a different default country", () => {
    expect(normalizePhone("0501234567", "20")).toBe("20501234567"); // Egypt
    expect(normalizePhone("+1 415 555 2671", "20")).toBe("14155552671"); // explicit intl wins
  });

  it("rejects junk / empty values", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+12")).toBeNull(); // too short
  });

  it("phoneMatchKey returns the last 9 subscriber digits for cross-format matching", () => {
    // Same subscriber typed three different ways -> same match key
    const a = phoneMatchKey(normalizePhone("050-123-4567"));
    const b = phoneMatchKey(normalizePhone("+972501234567"));
    const c = phoneMatchKey(normalizePhone("00972501234567"));
    expect(a).toBe("501234567");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(phoneMatchKey(null)).toBe("");
  });

  it("displayPhone adds a leading +", () => {
    expect(displayPhone("972501234567")).toBe("+972501234567");
    expect(displayPhone(null)).toBe("—");
  });
});

describe("whatsapp message status progression", () => {
  it("moves forward only (a late 'sent' never downgrades a 'read')", () => {
    expect(shouldApplyStatus("pending", "sent")).toBe(true);
    expect(shouldApplyStatus("sent", "delivered")).toBe(true);
    expect(shouldApplyStatus("delivered", "read")).toBe(true);
    expect(shouldApplyStatus("read", "sent")).toBe(false);
    expect(shouldApplyStatus("read", "delivered")).toBe(false);
    expect(shouldApplyStatus("sent", "sent")).toBe(false);
  });

  it("failures always apply (once), but not repeatedly", () => {
    expect(shouldApplyStatus("read", "failed")).toBe(true);
    expect(shouldApplyStatus("failed", "failed")).toBe(false);
    expect(WA_STATUS_RANK.failed).toBeGreaterThan(WA_STATUS_RANK.read);
  });

  it("maps Meta message types (unknown-safe)", () => {
    expect(mapMetaMessageType("text")).toBe("text");
    expect(mapMetaMessageType("image")).toBe("image");
    expect(mapMetaMessageType("voice")).toBe("audio");
    expect(mapMetaMessageType("sticker")).toBe("unknown");
    expect(mapMetaMessageType(undefined)).toBe("unknown");
  });
});

describe("whatsapp webhook signature verification", () => {
  const secret = "my_app_secret";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correct HMAC-SHA256 signature", () => {
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifySignature(secret, body, sig)).toBe(true);
  });

  it("rejects a wrong secret, tampered body, or malformed header", () => {
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifySignature("wrong_secret", body, sig)).toBe(false);
    expect(verifySignature(secret, body + "x", sig)).toBe(false);
    expect(verifySignature(secret, body, "deadbeef")).toBe(false); // no sha256= prefix
    expect(verifySignature(secret, body, null)).toBe(false);
    expect(verifySignature(null, body, sig)).toBe(false); // no secret configured
  });
});

describe("whatsapp webhook payload extraction", () => {
  it("extracts inbound messages with contact name + context", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PN_1" },
                contacts: [{ profile: { name: "أحمد" }, wa_id: "972501234567" }],
                messages: [
                  {
                    id: "wamid.INBOUND1",
                    from: "972501234567",
                    type: "text",
                    timestamp: "1723700000",
                    text: { body: "مرحبا" },
                    context: { id: "wamid.PREV" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const changes = extractChanges(payload);
    expect(changes).toHaveLength(1);
    expect(changes[0].phoneNumberId).toBe("PN_1");
    expect(changes[0].inbound).toHaveLength(1);
    expect(changes[0].inbound[0]).toMatchObject({
      wamid: "wamid.INBOUND1",
      from: "972501234567",
      name: "أحمد",
      type: "text",
      text: "مرحبا",
      contextWamid: "wamid.PREV",
    });
    expect(changes[0].inbound[0].timestamp).toBeInstanceOf(Date);
  });

  it("extracts status callbacks incl. failures", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PN_1" },
                statuses: [
                  { id: "wamid.OUT1", status: "delivered", timestamp: "1723700100" },
                  {
                    id: "wamid.OUT2",
                    status: "failed",
                    timestamp: "1723700200",
                    errors: [{ code: 131047, title: "Re-engagement message" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const changes = extractChanges(payload);
    expect(changes[0].statuses).toHaveLength(2);
    expect(changes[0].statuses[0]).toMatchObject({ wamid: "wamid.OUT1", status: "delivered" });
    expect(changes[0].statuses[1]).toMatchObject({
      wamid: "wamid.OUT2",
      status: "failed",
      errorCode: "131047",
    });
  });

  it("is defensive against malformed payloads", () => {
    expect(extractChanges(null)).toEqual([]);
    expect(extractChanges({})).toEqual([]);
    expect(extractChanges({ entry: [{}] })).toEqual([]);
    expect(extractChanges({ entry: [{ changes: [{ value: {} }] }] })).toEqual([]);
  });
});

describe("whatsapp template + text payloads", () => {
  it("builds a text payload without link preview", () => {
    expect(buildTextPayload("972501234567", "hello")).toEqual({
      to: "972501234567",
      type: "text",
      text: { preview_url: false, body: "hello" },
    });
  });

  it("builds a template payload with ordered body params", () => {
    const p = buildTemplatePayload("972501234567", "appointment_reminder", "ar", ["أحمد", "2026-08-20", "10:30"]);
    expect(p).toMatchObject({
      to: "972501234567",
      type: "template",
      template: {
        name: "appointment_reminder",
        language: { code: "ar" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "أحمد" },
              { type: "text", text: "2026-08-20" },
              { type: "text", text: "10:30" },
            ],
          },
        ],
      },
    });
  });

  it("omits components when a template has no params", () => {
    const p = buildTemplatePayload("972501234567", "follow_up", "ar", []) as {
      template: { components?: unknown };
    };
    expect(p.template.components).toBeUndefined();
  });

  it("looks up known templates only", () => {
    expect(findTemplate("appointment_reminder")?.label).toBe("تذكير بموعد");
    expect(findTemplate("does_not_exist")).toBeNull();
  });
});

describe("whatsapp 24-hour service window", () => {
  it("defaults to 24 hours", () => {
    expect(serviceWindowHours()).toBe(24);
  });

  it("is open right after an inbound message and closed after the window / when never contacted", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(isWithinServiceWindow(now)).toBe(true);
    expect(isWithinServiceWindow(oneHourAgo)).toBe(true);
    expect(isWithinServiceWindow(twentyFiveHoursAgo)).toBe(false);
    expect(isWithinServiceWindow(null)).toBe(false);
    expect(isWithinServiceWindow("not-a-date")).toBe(false);
  });
});
