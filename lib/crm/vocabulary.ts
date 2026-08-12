import type { MenuKey } from "@/lib/menu-navigation";

export type TenantBranding = {
  companyName: string;
  logoUrl: string | null;
  tagline: string;
  isDemo: boolean;
  companyType: string;
};

export type CrmVocabulary = {
  tagline: string;
  addCustomer: string;
  searchPlaceholder: string;
  dashboardSubtitle: string;
  subscribersSection: string;
  activePolicies: string;
  activeCustomers: string;
  inactiveCustomers: string;
  fullHistory: string;
  renewalsThisMonth: string;
  accidentsSection: string;
  accidentCases: string;
  importCustomers: string;
  editCustomer: string;
  newCustomer: string;
  kpiRevenue: string;
  kpiActiveAccounts: string;
  kpiActiveAccountsHelper: string;
  kpiCollectionRemaining: string;
  quickActionAccounts: string;
  revenueChartTitle: string;
  financeAccounting: string;
  tableCar: string;
  tableCarNumber: string;
  tableService: string;
  tableProvider: string;
  tableDocument: string;
  tableHistory: string;
  accidentTitle: string;
  accidentEmpty: string;
  accidentCustomer: string;
  activeCustomersTitle: string;
  activeCustomersSubtitle: string;
  activeCustomersSearch: string;
  subscriberHistoryTitle: string;
  subscriberHistorySubtitle: string;
  renewalsTitle: string;
  renewalsEmpty: string;
  pageTitles: Partial<Record<MenuKey, string>>;
  pageDescriptions: Partial<Record<MenuKey, string>>;
};

const insuranceVocabulary: CrmVocabulary = {
  tagline: "نظام إدارة التأمين",
  addCustomer: "إضافة مشترك",
  searchPlaceholder: "بحث شامل: عميل، تأمين، صفقة، مهمة، فاتورة...",
  dashboardSubtitle: "مؤشرات الأداء الرئيسية للتأمينات، التحصيل، الصفقات، والمهام.",
  subscribersSection: "المشتركون والتأمين",
  activePolicies: "التأمينات الفعالة",
  activeCustomers: "المشتركين الفعالين",
  inactiveCustomers: "غير الفعالين",
  fullHistory: "السجل الكامل",
  renewalsThisMonth: "تجديدات الشهر",
  accidentsSection: "الحوادث",
  accidentCases: "حالات الحوادث",
  importCustomers: "استيراد المشتركين",
  editCustomer: "تعديل مشترك",
  newCustomer: "إضافة مشترك جديد",
  kpiRevenue: "إيرادات التأمين",
  kpiActiveAccounts: "تأمينات فعالة",
  kpiActiveAccountsHelper: "وثائق نشطة",
  kpiCollectionRemaining: "متبقي للتحصيل",
  quickActionAccounts: "التأمينات",
  revenueChartTitle: "الإيرادات — آخر 6 أشهر",
  financeAccounting: "الحسابات والجباية",
  tableCar: "السيارة",
  tableCarNumber: "رقم السيارة",
  tableService: "التأمين",
  tableProvider: "الشركة",
  tableDocument: "وثيقة",
  tableHistory: "عرض سجل المشترك",
  accidentTitle: "حالات الحوادث",
  accidentEmpty: "لا توجد حوادث",
  accidentCustomer: "اسم المشترك",
  activeCustomersTitle: "المشتركين الفعالين",
  activeCustomersSubtitle: "هذه القائمة تعرض كل زبون مرة واحدة فقط، حتى لو عنده أكثر من تأمين فعال",
  activeCustomersSearch: "بحث باسم الزبون، الهاتف، رقم السيارة...",
  subscriberHistoryTitle: "سجل المشتركين",
  subscriberHistorySubtitle: "ابحث عن أي زبون واعرض كل التأمينات السابقة والحالية المرتبطة به",
  renewalsTitle: "التأمينات التي تحتاج تجديد هذا الشهر",
  renewalsEmpty: "لا يوجد تأمينات تحتاج تجديد هذا الشهر",
  pageTitles: {
    dashboard: "لوحة التحكم",
    "active-subscribers": "التأمينات الفعالة",
    "active-customers": "المشتركين الفعالين",
    "inactive-subscribers": "المشتركين غير الفعالين",
    "subscriber-history": "السجل",
    "renewals-this-month": "تجديدات هذا الشهر",
    "add-new-subscriber": "إضافة مشترك جديد",
    accident: "الحوادث",
    import: "استيراد المشتركين",
  },
  pageDescriptions: {
    dashboard: "نظرة تنفيذية على الأداء، الإيرادات، الصفقات، والمهام.",
    "active-subscribers": "متابعة التأمينات الفعالة وحالة كل وثيقة.",
    "active-customers": "عرض المشتركين الذين لديهم تأمينات فعالة حالياً.",
    "inactive-subscribers": "متابعة المشتركين غير الفعالين والوثائق المنتهية.",
    "subscriber-history": "السجل الكامل لكل التأمينات والزبائن.",
    "renewals-this-month": "تحليل خاص بتجديدات الشهر: من تم تجديده ومن بقي للتواصل معه.",
    import: "استيراد عملاء وتأمينات من ملف CSV.",
    accident: "إدارة حالات الحوادث وتحديثاتها.",
  },
};

const genericVocabulary: CrmVocabulary = {
  tagline: "نظام CRM شامل لإدارة العملاء والمبيعات",
  addCustomer: "عميل جديد",
  searchPlaceholder: "بحث شامل: عميل، صفقة، مهمة، فاتورة، رسالة...",
  dashboardSubtitle: "مؤشرات الأداء: العملاء، الإيرادات، الصفقات، المهام، والتواصل.",
  subscribersSection: "العملاء والحسابات",
  activePolicies: "الحسابات النشطة",
  activeCustomers: "العملاء النشطون",
  inactiveCustomers: "غير النشطين",
  fullHistory: "سجل العملاء",
  renewalsThisMonth: "متابعات الشهر",
  accidentsSection: "الدعم والبلاغات",
  accidentCases: "تذاكر الدعم",
  importCustomers: "استيراد العملاء",
  editCustomer: "تعديل عميل",
  newCustomer: "إضافة عميل جديد",
  kpiRevenue: "إيرادات المبيعات",
  kpiActiveAccounts: "حسابات نشطة",
  kpiActiveAccountsHelper: "عملاء بخدمة فعّالة",
  kpiCollectionRemaining: "مستحقات التحصيل",
  quickActionAccounts: "العملاء",
  revenueChartTitle: "الإيرادات — آخر 6 أشهر",
  financeAccounting: "الفوترة والتحصيل",
  tableCar: "الباقة / الخدمة",
  tableCarNumber: "رقم الحساب",
  tableService: "نوع الخدمة",
  tableProvider: "المنصة",
  tableDocument: "ملف",
  tableHistory: "عرض سجل العميل",
  accidentTitle: "تذاكر الدعم",
  accidentEmpty: "لا توجد تذاكر",
  accidentCustomer: "اسم العميل",
  activeCustomersTitle: "العملاء النشطون",
  activeCustomersSubtitle: "كل عميل يظهر مرة واحدة مع ملخص حساباته وخدماته النشطة",
  activeCustomersSearch: "بحث باسم العميل، الهاتف، رقم الحساب...",
  subscriberHistoryTitle: "سجل العملاء",
  subscriberHistorySubtitle: "ابحث عن أي عميل واعرض كل حساباته وتعاملاته السابقة والحالية",
  renewalsTitle: "متابعات وتجديدات هذا الشهر",
  renewalsEmpty: "لا توجد متابعات مطلوبة هذا الشهر",
  pageTitles: {
    dashboard: "لوحة التحكم",
    "active-subscribers": "الحسابات النشطة",
    "active-customers": "العملاء النشطون",
    "inactive-subscribers": "العملاء غير النشطين",
    "subscriber-history": "سجل العملاء",
    "renewals-this-month": "متابعات الشهر",
    "add-new-subscriber": "إضافة عميل جديد",
    accident: "تذاكر الدعم",
    import: "استيراد العملاء",
    accounting: "التحصيل والفوترة",
  },
  pageDescriptions: {
    dashboard: "نظرة تنفيذية على العملاء، الإيرادات، الصفقات، والمهام.",
    "active-subscribers": "متابعة الحسابات النشطة وخدمات كل عميل.",
    "active-customers": "عرض العملاء الذين لديهم حسابات أو خدمات فعّالة.",
    "inactive-subscribers": "متابعة العملاء غير النشطين والحسابات المغلقة.",
    "subscriber-history": "السجل الكامل لكل العملاء والتعاملات.",
    "renewals-this-month": "متابعات وتجديدات الشهر الحالي.",
    import: "استيراد العملاء من ملف CSV.",
    accident: "إدارة بلاغات الدعم ومتابعة الحالات.",
    inbox: "واتساب، Gmail، SMS — راسل العملاء ورد عليهم من مكان واحد.",
  },
};

export function getCrmVocabulary(isDemo: boolean): CrmVocabulary {
  return isDemo ? genericVocabulary : insuranceVocabulary;
}

export function getPageTitle(menu: MenuKey, isDemo: boolean, editingCustomer = false): string {
  const vocabulary = getCrmVocabulary(isDemo);
  if (menu === "add-new-subscriber") {
    return editingCustomer ? vocabulary.editCustomer : vocabulary.newCustomer;
  }
  return vocabulary.pageTitles[menu] || defaultPageTitle(menu, isDemo);
}

function defaultPageTitle(menu: MenuKey, isDemo = false): string {
  switch (menu) {
    case "tasks":
      return "المهام والمتابعات";
    case "calendar":
      return "تقويم المهام";
    case "deals":
      return "مسار الصفقات";
    case "quotes":
      return "عروض الأسعار";
    case "invoices":
      return "الفواتير";
    case "reports":
      return "التقارير";
    case "role-templates":
      return "قوالب الأدوار";
    case "settings":
      return "إعدادات الشركة";
    case "automation":
      return "الأتمتة";
    case "integrations":
      return "التكاملات و API";
    case "products":
      return "المنتجات والخدمات";
    case "contracts":
      return "العقود";
    case "archived-customers":
      return "الأرشيف";
    case "files":
      return "مدير الملفات";
    case "inbox":
      return "صندوق التواصل";
    case "accounting":
      return isDemo ? "الفوترة والتحصيل" : "الحسابات والجباية";
    case "user-management":
      return "إدارة المستخدمين";
    case "activity-log":
      return "سجل النشاطات";
    default:
      return isDemo ? "تذاكر الدعم" : "الحوادث";
  }
}

export function getPageDescriptionForTenant(menu: MenuKey, isDemo: boolean): string {
  const vocabulary = getCrmVocabulary(isDemo);
  if (vocabulary.pageDescriptions[menu]) {
    return vocabulary.pageDescriptions[menu]!;
  }
  return getLegacyPageDescription(menu);
}

function getLegacyPageDescription(menu: MenuKey): string {
  switch (menu) {
    case "tasks":
      return "متابعة المهام والمتابعات اليومية مع العملاء.";
    case "calendar":
      return "عرض المهام والمواعيد على التقويم.";
    case "deals":
      return "إدارة مسار الصفقات من العميل الجديد حتى الإغلاق.";
    case "quotes":
      return "إنشاء عروض الأسعار ومتابعة حالات الموافقة.";
    case "invoices":
      return "إصدار الفواتير ومتابعة المدفوعات والمتأخرات.";
    case "reports":
      return "تقارير المبيعات والإيرادات والصفقات مع تصدير CSV.";
    case "settings":
      return "إعدادات الشركة والعملة والضريبة والتنسيقات.";
    case "role-templates":
      return "قوالب الأدوار لتطبيق الصلاحيات على المستخدمين.";
    case "automation":
      return "قواعد أتمتة لإنشاء مهام متابعة تلقائياً.";
    case "archived-customers":
      return "عرض واستعادة العملاء المؤرشفين.";
    case "files":
      return "رفع وتنظيم ملفات العملاء والمستندات.";
    case "inbox":
      return "واتساب، Gmail، SMS، وإنستغرام — الرسائل الواردة والصادرة.";
    case "accounting":
      return "متابعة المدفوعات والمتبقي وطرق التحصيل.";
    default:
      return "إدارة العملاء والصفقات والتواصل من داخل النظام.";
  }
}

export const DEFAULT_LOGO_URL = "/loag.png";
export const DEMO_LOGO_URL = "/gosol-crm-logo.svg";

export function resolveBranding(input: {
  companyName?: string | null;
  logoUrl?: string | null;
  isDemo?: boolean;
  companyType?: string | null;
}): TenantBranding {
  const isDemo = Boolean(input.isDemo);
  const vocabulary = getCrmVocabulary(isDemo);
  return {
    isDemo,
    companyType: String(input.companyType || "insurance"),
    companyName: String(input.companyName || (isDemo ? "Gosol CRM" : "Elite Insurance")),
    logoUrl: input.logoUrl || (isDemo ? DEMO_LOGO_URL : DEFAULT_LOGO_URL),
    tagline: vocabulary.tagline,
  };
}
