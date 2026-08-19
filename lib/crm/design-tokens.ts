/** Shared CRM design tokens (Gosol CRM theme — deep navy + blue accent from the Gosol logo). */
export const crmColors = {
  primary: "#3B82F6", // Gosol brand blue — primary actions / active states
  primaryDark: "#2563EB", // hover / pressed
  navy: "#0B1E4D", // deep navy — headings, dark surfaces
  primaryLight: "#EFF4FF",
  primaryMuted: "#DBEAFE",
  border: "#E6EAF0",
  borderLight: "#EEF1F4",
  text: "#0F1E33",
  textMuted: "#64748B",
  textSubtle: "#8B95A1",
  surface: "#FFFFFF",
  background: "#F6F8FB",
  sidebarBg: "#FFFFFF",
} as const;

export const crmRadii = {
  card: "rounded-[26px]",
  cardLg: "rounded-[28px]",
  cardXl: "rounded-[34px]",
  button: "rounded-xl",
  pill: "rounded-full",
} as const;

/** Restrained Gosol chart palette (blue-family, harmonized with the brand). */
export const chartColors = [
  "#3B82F6",
  "#0B1E4D",
  "#60A5FA",
  "#0EA5E9",
  "#2563EB",
  "#38BDF8",
  "#93C5FD",
  "#64748B",
] as const;
