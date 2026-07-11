import { formatDateForInput } from "@/lib/crm/utils";

export type CustomerProfileFields = {
  email: string;
  address: string;
  city: string;
  country: string;
  birthday: string;
  gender: string;
  occupation: string;
  customerStatus: string;
  source: string;
  notes: string;
  tags: string;
  profileImage: string;
};

export const emptyCustomerProfile: CustomerProfileFields = {
  email: "",
  address: "",
  city: "",
  country: "",
  birthday: "",
  gender: "",
  occupation: "",
  customerStatus: "فعال",
  source: "",
  notes: "",
  tags: "",
  profileImage: "",
};

function strOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function readCustomerProfileFromBody(body: Record<string, unknown>) {
  return {
    email: strOrNull(body.email),
    address: strOrNull(body.address),
    city: strOrNull(body.city),
    country: strOrNull(body.country),
    birthday: strOrNull(body.birthday),
    gender: strOrNull(body.gender),
    occupation: strOrNull(body.occupation),
    customerStatus: strOrNull(body.customerStatus) || "فعال",
    source: strOrNull(body.source),
    notes: strOrNull(body.notes),
    tags: strOrNull(body.tags),
    profileImage: strOrNull(body.profileImage),
  };
}

export function mapCustomerProfileFromRow(customer: Record<string, unknown>): CustomerProfileFields {
  return {
    email: String(customer.email || ""),
    address: String(customer.address || ""),
    city: String(customer.city || ""),
    country: String(customer.country || ""),
    birthday: formatDateForInput(customer.birthday),
    gender: String(customer.gender || ""),
    occupation: String(customer.occupation || ""),
    customerStatus: String(customer.customerStatus || "فعال"),
    source: String(customer.source || ""),
    notes: String(customer.notes || ""),
    tags: String(customer.tags || ""),
    profileImage: String(customer.profileImage || ""),
  };
}

export function customerProfileSqlValues(profile: ReturnType<typeof readCustomerProfileFromBody>) {
  return [
    profile.email,
    profile.address,
    profile.city,
    profile.country,
    profile.birthday ? new Date(profile.birthday) : null,
    profile.gender,
    profile.occupation,
    profile.customerStatus,
    profile.source,
    profile.notes,
    profile.tags,
    profile.profileImage,
  ];
}

export function customerProfileUpdateClause() {
  return `email = ?, address = ?, city = ?, country = ?, birthday = ?, gender = ?, occupation = ?, customerStatus = ?, source = ?, notes = ?, tags = ?, profileImage = ?`;
}

export function customerProfileInsertColumns() {
  return "email, address, city, country, birthday, gender, occupation, customerStatus, source, notes, tags, profileImage";
}

export function customerProfileInsertPlaceholders() {
  return "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
}

export function buildCustomerProfileBody(profile: CustomerProfileFields) {
  return {
    email: profile.email || null,
    address: profile.address || null,
    city: profile.city || null,
    country: profile.country || null,
    birthday: profile.birthday || null,
    gender: profile.gender || null,
    occupation: profile.occupation || null,
    customerStatus: profile.customerStatus || "فعال",
    source: profile.source || null,
    notes: profile.notes || null,
    tags: profile.tags || null,
    profileImage: profile.profileImage || null,
  };
}
