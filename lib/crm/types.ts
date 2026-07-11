import type { MenuKey } from "@/lib/menu-navigation";

import type { CustomerProfileFields } from "@/lib/crm/customer-profile";

export type { CustomerProfileFields };
export type InsuranceMainType = "" | "third" | "full";
export type InsuranceStatus = "فعال" | "جديد" | "غير فعال" | "منتهي";
export type PaidStatus =
  | "فيزا"
  | "كاش"
  | "شيكات"
  | "كاش + فيزا"
  | "كاش + شيكات"
  | "فيزا + شيكات"
  | "كاش + فيزا + شيكات"
  | "لاحقًا";
export type AccidentStatus = "مفتوح" | "مغلق";

export type DocumentKey =
  | "drivingLicense"
  | "carLicense"
  | "companionId"
  | "carImage1"
  | "carImage2"
  | "carImage3"
  | "carImage4"
  | "carImage5"
  | "insurancePolicy1"
  | "insurancePolicy2"
  | "otherDocument"
  | "otherDocument2"
  | "otherDocument3";

export type SubscriberDocuments = {
  drivingLicense: string;
  carLicense: string;
  companionId: string;
  carImage1: string;
  carImage2: string;
  carImage3: string;
  carImage4: string;
  carImage5: string;
  insurancePolicy1: string;
  insurancePolicy2: string;
  otherDocument: string;
  otherDocument2: string;
  otherDocument3: string;
};

export type CheckItem = {
  checkNumber: string;
  bankName: string;
  dueDate: string;
  amount: number;
};

type SubscriberCore = {
  id: number;
  customerId: number;
  carId: number;
  subscriberName: string;
  carName: string;
  carNumber: string;
  carYear: string;
  customerNumber: string;
  insuranceType: string;
  insuranceCompany: string;
  startDate: string;
  endDate: string;
  insuranceStatus: InsuranceStatus;
  paidStatus: PaidStatus;
  hofaaEnabled: boolean;
  hofaaPrice: number;
  thirdPartyEnabled: boolean;
  thirdPartyPrice: number;
  fullEnabled: boolean;
  fullPrice: number;
  totalAmount: number;
  paidAmount: number;
  cashAmount: number;
  visaAmount: number;
  checksAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  checks: CheckItem[];
  history: string;
  policyImage: string;
  documents: SubscriberDocuments;
};

export type Subscriber = SubscriberCore & CustomerProfileFields;

export type CustomerNode = {
  customerKey: string;
  customerId: number;
  subscriberName: string;
  customerNumber: string;
  cars: Subscriber[];
};

export type AccidentUpdate = {
  id: number;
  text: string;
  date: string;
};

export type AccidentCase = {
  id: number;
  customerId: number;
  carId: number;
  caseNumber: string;
  subscriberName: string;
  customerNumber: string;
  carName: string;
  carNumber: string;
  insuranceCompany: string;
  insuranceType: string;
  details: string;
  status: AccidentStatus;
  openedAt: string;
  updates: AccidentUpdate[];
};

export type AppUser = {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  companyId?: number | null;
  viewSubscribers: boolean;
  createSubscribers: boolean;
  editSubscribers: boolean;
  deleteSubscribers: boolean;
  viewAccidents: boolean;
  createAccidents: boolean;
  editAccidents: boolean;
  deleteAccidents: boolean;
  viewAccounting: boolean;
  editPayments: boolean;
  viewUsers: boolean;
  createUsers: boolean;
  editUsers: boolean;
  deleteUsers: boolean;
  viewActivityLog: boolean;
};

export type ActivityLog = {
  id: number;
  username: string;
  action: string;
  module: string;
  targetId?: string | null;
  details?: string | null;
  createdAt: string;
};

type FormCore = {
  subscriberName: string;
  carName: string;
  carNumber: string;
  carYear: string;
  customerNumber: string;
  insuranceType: {
    hofaa: boolean;
    type: InsuranceMainType;
  };
  insuranceCompany: string;
  startDate: string;
  endDate: string;
  insuranceStatus: InsuranceStatus;
  paidStatus: PaidStatus;
  hofaaPrice: number;
  thirdPartyPrice: number;
  fullPrice: number;
  paidAmount: number;
  cashAmount: number;
  visaAmount: number;
  checksAmount: number;
  checks: CheckItem[];
  history: string;
  policyImage: string;
  documents: SubscriberDocuments;
};

export type FormState = FormCore & CustomerProfileFields;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DashboardStats = {
  activePolicies: number;
  activeCustomers: number;
  totalCustomers: number;
  openAccidents: number;
  renewalsThisMonth: number;
};

export type MenuInsightsData = {
  totalRecords: number;
  eyebrow: string;
  description: string;
  cards: { label: string; value: number | string; helper: string }[];
  charts: {
    kind: "pie" | "bar" | "area";
    title: string;
    badge: string;
    data: { name: string; value: number }[];
    money?: boolean;
  }[];
};

export type { MenuKey };
