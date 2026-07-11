import { execute } from "@/lib/db";

type ActivityUser = {
  id: number;
  username: string;
};

type ActivityMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeActivityLog(
  user: ActivityUser,
  action: string,
  module: string,
  details?: string | null,
  targetId?: string | number | null,
  meta?: ActivityMeta
) {
  try {
    await execute(
      `INSERT INTO ActivityLog (userId, username, action, module, targetId, details, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user.id,
        user.username,
        action,
        module,
        targetId != null ? String(targetId) : null,
        details ?? null,
        meta?.ipAddress ?? null,
        meta?.userAgent ?? null,
      ]
    );
  } catch (error) {
    console.error("Activity log failed:", error);
  }
}
