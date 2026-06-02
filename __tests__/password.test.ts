import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHashed, verifyPassword } from "@/lib/password";

describe("isPasswordHashed", () => {
  it("detects bcrypt hashes", () => {
    expect(isPasswordHashed("$2a$12$abcdefghijklmnopqrstuv")).toBe(true);
    expect(isPasswordHashed("$2b$12$abcdefghijklmnopqrstuv")).toBe(true);
    expect(isPasswordHashed("plain-text")).toBe(false);
  });
});

describe("verifyPassword", () => {
  it("compares plaintext passwords for legacy users", async () => {
    await expect(verifyPassword("secret123", "secret123")).resolves.toBe(true);
    await expect(verifyPassword("wrong", "secret123")).resolves.toBe(false);
  });

  it("compares bcrypt hashes", async () => {
    const hashed = await hashPassword("secret123");
    await expect(verifyPassword("secret123", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hashed)).resolves.toBe(false);
  });
});

describe("hashPassword", () => {
  it("returns a bcrypt hash", async () => {
    const hashed = await hashPassword("secret123");
    expect(isPasswordHashed(hashed)).toBe(true);
    await expect(verifyPassword("secret123", hashed)).resolves.toBe(true);
  });
});
