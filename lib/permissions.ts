import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export type PermissionKey =
  | "viewSubscribers"
  | "createSubscribers"
  | "editSubscribers"
  | "deleteSubscribers"
  | "viewAccidents"
  | "createAccidents"
  | "editAccidents"
  | "deleteAccidents"
  | "viewAccounting"
  | "editPayments"
  | "viewUsers"
  | "createUsers"
  | "editUsers"
  | "deleteUsers"
  | "viewActivityLog";

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireUser(): Promise<{ user: CurrentUser } | NextResponse> {
  const user = await getCurrentUser();

  if (!user || Number(user.isActive) !== 1) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return { user };
}

export async function requirePermission(
  permission: PermissionKey
): Promise<{ user: CurrentUser } | NextResponse> {
  const result = await requireUser();

  if (isErrorResponse(result)) {
    return result;
  }

  if (Number(result.user[permission]) !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return result;
}

export async function requireAnyPermission(
  ...permissions: PermissionKey[]
): Promise<{ user: CurrentUser } | NextResponse> {
  const result = await requireUser();

  if (isErrorResponse(result)) {
    return result;
  }

  const allowed = permissions.some((permission) => Number(result.user[permission]) === 1);

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return result;
}
