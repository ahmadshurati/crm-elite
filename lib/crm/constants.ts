import type { MenuKey } from "@/lib/menu-navigation";
import type { DocumentKey, FormState, SubscriberDocuments } from "@/lib/crm/types";
import { emptyCustomerProfile } from "@/lib/crm/customer-profile";

export const CUSTOMERS_API_URL = "/api/customers";
export const CUSTOMERS_INSIGHTS_API_URL = "/api/customers/insights";
export const ACCIDENTS_API_URL = "/api/accidents";
export const TASKS_API_URL = "/api/tasks";
export const DEALS_API_URL = "/api/deals";
export const QUOTES_API_URL = "/api/quotes";
export const INVOICES_API_URL = "/api/invoices";
export const NOTIFICATIONS_API_URL = "/api/notifications";
export const SEARCH_API_URL = "/api/search";
export const REPORTS_SUMMARY_API_URL = "/api/reports/summary";
export const REPORTS_EXPORT_API_URL = "/api/reports/export";
export const ROLES_API_URL = "/api/roles";
export const SETTINGS_API_URL = "/api/settings";
export const CUSTOMERS_IMPORT_API_URL = "/api/customers/import";
export const AUTOMATION_API_URL = "/api/automation";
export const INTEGRATIONS_STATUS_API_URL = "/api/integrations/status";
export const INTEGRATIONS_MESSAGES_API_URL = "/api/integrations/messages";
export const PRODUCTS_API_URL = "/api/products";
export const CONTRACTS_API_URL = "/api/contracts";
export const API_KEYS_API_URL = "/api/api-keys";
export const OPENAPI_API_URL = "/api/openapi";
export const EMAIL_TEMPLATES_API_URL = "/api/email-templates";
export const FIELD_AUDIT_API_URL = "/api/field-audit";
export const FILES_API_URL = "/api/files";
export const INBOX_API_URL = "/api/inbox";
export const BACKUP_EXPORT_API_URL = "/api/backup/export";
export const V1_CUSTOMERS_API_URL = "/api/v1/customers";
export const DEFAULT_PAGE_LIMIT = 50;

export const INSIGHT_MENUS: MenuKey[] = [
  "active-subscribers",
  "active-customers",
  "inactive-subscribers",
  "subscriber-history",
  "renewals-this-month",
  "accounting",
];

export const emptyDocuments: SubscriberDocuments = {
  drivingLicense: "",
  carLicense: "",
  companionId: "",
  carImage1: "",
  carImage2: "",
  carImage3: "",
  carImage4: "",
  carImage5: "",
  insurancePolicy1: "",
  insurancePolicy2: "",
  otherDocument: "",
  otherDocument2: "",
  otherDocument3: "",
};

export const emptyForm: FormState = {
  subscriberName: "",
  carName: "",
  carNumber: "",
  carYear: "",
  customerNumber: "",
  insuranceType: {
    hofaa: false,
    type: "",
  },
  insuranceCompany: "",
  startDate: "",
  endDate: "",
  insuranceStatus: "فعال",
  paidStatus: "لاحقًا",
  hofaaPrice: 0,
  thirdPartyPrice: 0,
  fullPrice: 0,
  paidAmount: 0,
  cashAmount: 0,
  visaAmount: 0,
  checksAmount: 0,
  checks: [
    {
      checkNumber: "",
      bankName: "",
      dueDate: "",
      amount: 0,
    },
  ],
  history: "",
  policyImage: "",
  documents: emptyDocuments,
  ...emptyCustomerProfile,
};

export const documentLabels: Record<DocumentKey, string> = {
  drivingLicense: "رخصة القيادة",
  carLicense: "رخصة السيارة",
  companionId: "هوية مرافق إن وجد",
  carImage1: "صورة المركبة 1",
  carImage2: "صورة المركبة 2",
  carImage3: "صورة المركبة 3",
  carImage4: "صورة المركبة 4",
  carImage5: "صورة المركبة 5",
  insurancePolicy1: "وثيقة التأمين 1",
  insurancePolicy2: "وثيقة التأمين 2",
  otherDocument: "مستند آخر",
  otherDocument2: "مستند آخر 2",
  otherDocument3: "مستند آخر 3",
};
