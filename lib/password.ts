import bcrypt from "bcryptjs";
import { execute } from "@/lib/db";

const SALT_ROUNDS = 12;

export function isPasswordHashed(password: string) {
  return password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, storedPassword: string) {
  if (isPasswordHashed(storedPassword)) {
    return bcrypt.compare(password, storedPassword);
  }

  return password === storedPassword;
}

export async function upgradePasswordIfNeeded(userId: number, password: string, storedPassword: string) {
  if (isPasswordHashed(storedPassword)) return;

  const hashed = await hashPassword(password);
  await execute("UPDATE AppUser SET password = ?, updatedAt = NOW() WHERE id = ?", [hashed, userId]);
}
