import { describe, expect, it } from "vitest";
import { getIntegrationStatus } from "@/lib/integrations/config";
import { generateApiKeyValue, API_KEY_PREFIX } from "@/lib/api-keys";
import { generateTotpSecret, buildTotpUri, verifyTotpCode } from "@/lib/totp";
import { generateSync } from "otplib";

describe("integration config", () => {
  it("reports unconfigured providers when env is empty", () => {
    const status = getIntegrationStatus();
    expect(status.email.configured).toBe(false);
    expect(status.sms.configured).toBe(false);
    expect(status.whatsapp.configured).toBe(false);
    expect(status.ai.configured).toBe(false);
  });
});

describe("api keys", () => {
  it("generates keys with elite prefix", () => {
    const key = generateApiKeyValue();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });
});

describe("totp", () => {
  it("generates and verifies a code", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri("testuser", secret);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);

    const token = generateSync({ secret });
    expect(verifyTotpCode(secret, token)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });
});
