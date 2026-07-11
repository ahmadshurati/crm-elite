export const DEAL_STAGES = [
  "new-lead",
  "contacted",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const dealStageLabels: Record<DealStage, string> = {
  "new-lead": "عميل جديد",
  contacted: "تم التواصل",
  proposal: "عرض مُرسل",
  negotiation: "تفاوض",
  won: "مكسوب",
  lost: "مفقود",
};

export type DealRecord = {
  id: number;
  customerId: number;
  assignedUserId: number | null;
  title: string;
  stage: DealStage | string;
  value: number;
  probability: number;
  expectedClose: string | null;
  notes: string | null;
  customerName?: string | null;
  assignedUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value);
}
