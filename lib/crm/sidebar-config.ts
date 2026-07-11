import type { MenuKey } from "@/lib/menu-navigation";
import { getCrmVocabulary } from "@/lib/crm/vocabulary";

export type SidebarNavItem = {
  label: string;
  key: MenuKey;
  count?: number;
};

export type SidebarSection = {
  id: string;
  label: string;
  items: SidebarNavItem[];
};

export function sectionContainsKey(section: SidebarSection, key: MenuKey) {
  return section.items.some((item) => item.key === key);
}

export function buildSidebarSections(input: {
  canViewSubscribers: boolean;
  canCreateSubscribers: boolean;
  canEditSubscribers: boolean;
  canViewAccidents: boolean;
  canViewAccounting: boolean;
  canViewUsers: boolean;
  canEditUsers: boolean;
  canViewActivityLog: boolean;
  renewalsThisMonthCount: number;
  isDemo?: boolean;
  isMaster?: boolean;
}): SidebarSection[] {
  const vocabulary = getCrmVocabulary(Boolean(input.isDemo));
  const sections: SidebarSection[] = [];

  if (input.canViewSubscribers) {
    sections.push({
      id: "dashboard",
      label: "الرئيسية",
      items: [{ label: "لوحة التحكم", key: "dashboard" }],
    });

    sections.push({
      id: "subscribers",
      label: vocabulary.subscribersSection,
      items: [
        { label: vocabulary.activePolicies, key: "active-subscribers" },
        { label: vocabulary.activeCustomers, key: "active-customers" },
        { label: vocabulary.inactiveCustomers, key: "inactive-subscribers" },
        { label: vocabulary.fullHistory, key: "subscriber-history" },
        {
          label: vocabulary.renewalsThisMonth,
          key: "renewals-this-month",
          count: input.renewalsThisMonthCount,
        },
      ],
    });

    if (input.canCreateSubscribers || input.canEditSubscribers) {
      const tools: SidebarNavItem[] = [];
      if (input.canCreateSubscribers) {
        tools.push({ label: "استيراد CSV", key: "import" });
      }
      if (input.canEditSubscribers) {
        tools.push({ label: "الأرشيف", key: "archived-customers" });
      }
      if (tools.length) {
        sections.push({ id: "subscriber-tools", label: "إجراءات سريعة", items: tools });
      }
    }

    sections.push({
      id: "communications",
      label: "التواصل والرسائل",
      items: [{ label: "صندوق الوارد", key: "inbox" }],
    });

    sections.push({
      id: "crm-ops",
      label: "المتابعة والصفقات",
      items: [
        { label: "المهام", key: "tasks" },
        { label: "التقويم", key: "calendar" },
        { label: "مسار الصفقات", key: "deals" },
        { label: "مدير الملفات", key: "files" },
        { label: "المنتجات", key: "products" },
        { label: "العقود", key: "contracts" },
      ],
    });
  }

  if (input.canViewAccidents) {
    sections.push({
      id: "accidents",
      label: vocabulary.accidentsSection,
      items: [{ label: vocabulary.accidentCases, key: "accident" }],
    });
  }

  if (input.canViewAccounting) {
    sections.push({
      id: "finance",
      label: "المالية",
      items: [
        { label: vocabulary.financeAccounting, key: "accounting" },
        { label: "عروض الأسعار", key: "quotes" },
        { label: "الفواتير", key: "invoices" },
        { label: "التقارير", key: "reports" },
      ],
    });
  } else if (input.canViewSubscribers) {
    sections.push({
      id: "finance",
      label: "المالية",
      items: [{ label: "عروض الأسعار", key: "quotes" }],
    });
  }

  const adminItems: SidebarNavItem[] = [];
  if (input.isMaster) {
    if (input.canViewUsers) {
      adminItems.push({ label: "المستخدمون", key: "user-management" });
      adminItems.push({ label: "قوالب الأدوار", key: "role-templates" });
    }
    if (input.canEditUsers) {
      adminItems.push({ label: "إعدادات الشركة", key: "settings" });
      adminItems.push({ label: "الأتمتة", key: "automation" });
      adminItems.push({ label: "التكاملات و API", key: "integrations" });
    }
    if (input.canViewActivityLog) {
      adminItems.push({ label: "سجل النشاطات", key: "activity-log" });
    }
  }

  if (adminItems.length) {
    sections.push({ id: "admin", label: "إدارة النظام", items: adminItems });
  }

  return sections;
}
