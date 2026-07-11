export const COMMUNICATION_TYPES = [
  "call",
  "email",
  "whatsapp",
  "meeting",
  "visit",
  "note",
] as const;

export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

export const communicationTypeLabels: Record<CommunicationType, string> = {
  call: "مكالمة هاتفية",
  email: "بريد إلكتروني",
  whatsapp: "واتساب",
  meeting: "اجتماع",
  visit: "زيارة مكتب",
  note: "ملاحظة",
};

export type CustomerCommunicationRecord = {
  id: number;
  customerId: number;
  userId: number | null;
  username: string;
  type: CommunicationType | string;
  occurredAt: string;
  summary: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export function isCommunicationType(value: string): value is CommunicationType {
  return (COMMUNICATION_TYPES as readonly string[]).includes(value);
}
