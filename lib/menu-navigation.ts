export const MENU_KEYS = [
  "dashboard",
  "active-subscribers",
  "active-customers",
  "inactive-subscribers",
  "subscriber-history",
  "renewals-this-month",
  "add-new-subscriber",
  "accident",
  "tasks",
  "calendar",
  "deals",
  "quotes",
  "invoices",
  "reports",
  "settings",
  "role-templates",
  "import",
  "automation",
  "integrations",
  "products",
  "contracts",
  "files",
  "inbox",
  "archived-customers",
  "accounting",
  "user-management",
  "activity-log",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export function isMenuKey(value: string | null | undefined): value is MenuKey {
  if (!value) return false;
  return (MENU_KEYS as readonly string[]).includes(value);
}

export function parseMenuFromSearchParams(
  searchParams: URLSearchParams,
  fallback: MenuKey = "dashboard"
): MenuKey {
  const section = searchParams.get("section");
  return isMenuKey(section) ? section : fallback;
}

export function buildSectionUrl(pathname: string, menu: MenuKey, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("section", menu);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
