import type { MenuKey } from "@/lib/menu-navigation";

export function mapMenuToCustomerFilter(menu: MenuKey) {
  switch (menu) {
    case "active-subscribers":
    case "active-customers":
      return "active";
    case "inactive-subscribers":
      return "inactive";
    case "renewals-this-month":
      return "renewals-this-month";
    case "archived-customers":
      return "archived";
    default:
      return "all";
  }
}

export function formatHeaderDate() {
  return new Intl.DateTimeFormat("ar", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

export function getPageDescription(menu: MenuKey) {
  switch (menu) {
    case "dashboard":
      return "نظرة تنفيذية على الأداء، الإيرادات، الصفقات، والمهام.";
    case "renewals-this-month":
      return "تحليل خاص بتجديدات الشهر: من تم تجديده ومن بقي للتواصل معه، مع توزيع الشركات والمواعيد.";
    case "active-subscribers":
      return "متابعة التأمينات الفعالة وحالة كل وثيقة.";
    case "active-customers":
      return "عرض المشتركين الذين لديهم تأمينات فعالة حالياً.";
    case "inactive-subscribers":
      return "متابعة المشتركين غير الفعالين والوثائق المنتهية.";
    case "subscriber-history":
      return "السجل الكامل لكل التأمينات والزبائن.";
    case "accounting":
      return "متابعة المدفوعات والمتبقي وطرق التحصيل.";
    case "accident":
      return "إدارة حالات الحوادث وتحديثاتها.";
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
    case "import":
      return "استيراد عملاء وتأمينات من ملف CSV.";
    case "automation":
      return "قواعد أتمتة لإنشاء مهام متابعة تلقائياً.";
    case "archived-customers":
      return "عرض واستعادة العملاء المؤرشفين.";
    case "files":
      return "رفع وتنظيم ملفات العملاء والمستندات.";
    case "inbox":
      return "واتساب، Gmail، SMS، وإنستغرام — الرسائل الواردة والصادرة.";
    default:
      return "إدارة المشتركين وبيانات التأمين والحوادث من داخل النظام";
  }
}
