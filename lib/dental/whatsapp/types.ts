// Shared WhatsApp types + pure status/type helpers (unit-tested).

export type WaDirection = "inbound" | "outbound";
export type WaStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type WaType =
  | "text"
  | "template"
  | "interactive"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "location"
  | "unknown";

export const WA_STATUSES: WaStatus[] = ["pending", "sent", "delivered", "read", "failed"];

// Progression rank. A status update only "sticks" if it moves forward (or is a failure),
// so a late "sent" callback can never downgrade a message already "read".
export const WA_STATUS_RANK: Record<WaStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

export function isWaStatus(v: unknown): v is WaStatus {
  return typeof v === "string" && (WA_STATUSES as string[]).includes(v);
}

/** Should we overwrite `current` with `next`? Failures always apply; otherwise only forward moves. */
export function shouldApplyStatus(current: WaStatus, next: WaStatus): boolean {
  if (next === "failed") return current !== "failed";
  return WA_STATUS_RANK[next] > WA_STATUS_RANK[current];
}

/** Map a Meta message `type` string to our internal enum (unknown-safe). */
export function mapMetaMessageType(t: unknown): WaType {
  const s = String(t || "").toLowerCase();
  switch (s) {
    case "text":
      return "text";
    case "template":
      return "template";
    case "interactive":
      return "interactive";
    case "button":
      return "text";
    case "image":
      return "image";
    case "document":
      return "document";
    case "audio":
    case "voice":
      return "audio";
    case "video":
      return "video";
    case "location":
      return "location";
    default:
      return "unknown";
  }
}

export type WaConversation = {
  id: number;
  patientId: number | null;
  patientName: string | null;
  phone: string;
  waName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  unreadCount: number;
  status: string;
  withinWindow: boolean;
};

export type WaMessage = {
  id: number;
  wamid: string | null;
  direction: WaDirection;
  type: WaType;
  body: string | null;
  mediaUrl: string | null;
  templateName: string | null;
  status: WaStatus;
  errorMessage: string | null;
  contextWamid: string | null;
  timestamp: string | null;
};
