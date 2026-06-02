import { execute } from "@/lib/db";

type ActivityUser = {
  id: number;
  username: string;
};

export async function writeActivityLog(
  user: ActivityUser,
  action: string,
  module: string,
  details?: string | null,
  targetId?: string | number | null
) {
  try {
    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [
        user.id,
        user.username,
        action,
        module,
        targetId != null ? String(targetId) : null,
        details ?? null,
      ]
    );
  } catch (error) {
    console.error("Activity log failed:", error);
  }
}
