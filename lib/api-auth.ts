import { NextResponse } from "next/server";
import { extractApiKeyFromRequest, validateApiKey } from "@/lib/api-keys";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { isErrorResponse, requireUser } from "@/lib/permissions";

export type ApiAuthContext = {
  type: "session" | "api-key";
  user: CurrentUser | null;
  apiKey: Awaited<ReturnType<typeof validateApiKey>>;
};

export async function requireSessionOrApiKey(req: Request, requiredScope?: string) {
  const apiKeyValue = extractApiKeyFromRequest(req);
  if (apiKeyValue) {
    const apiKey = await validateApiKey(apiKeyValue);
    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes("*")) {
      return NextResponse.json({ error: "Insufficient API key scope" }, { status: 403 });
    }

    return { type: "api-key" as const, user: null, apiKey };
  }

  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;
  return { type: "session" as const, user: auth.user, apiKey: null };
}

export async function getOptionalAuth(req: Request) {
  const apiKeyValue = extractApiKeyFromRequest(req);
  if (apiKeyValue) {
    const apiKey = await validateApiKey(apiKeyValue);
    if (apiKey) return { type: "api-key" as const, user: null, apiKey };
  }

  const user = await getCurrentUser();
  if (user) return { type: "session" as const, user, apiKey: null };
  return null;
}
