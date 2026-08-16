import { generateSecret, generateURI, verifySync } from "otplib";

export function generateTotpSecret() {
  return generateSecret();
}

export function buildTotpUri(username: string, secret: string, issuer = "Gosol CRM") {
  return generateURI({ issuer, label: username, secret });
}

export function verifyTotpCode(secret: string, token: string) {
  const result = verifySync({ secret, token: String(token || "").trim() });
  return typeof result === "boolean" ? result : Boolean((result as { valid?: boolean }).valid);
}
