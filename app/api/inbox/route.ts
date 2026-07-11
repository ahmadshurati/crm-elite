import { NextResponse } from "next/server";
import { getInboxUnreadCounts, listInboxMessages } from "@/lib/inbox";
import { getIntegrationStatus, type InboxChannel } from "@/lib/integrations/config";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHANNELS = new Set<InboxChannel>(["all", "whatsapp", "gmail", "email", "sms", "instagram"]);

async function handleGet(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const companyId = requireCompanyId(auth.user);
  const url = new URL(req.url);
  const channelParam = url.searchParams.get("channel") || "all";
  const channel = VALID_CHANNELS.has(channelParam as InboxChannel)
    ? (channelParam as InboxChannel)
    : "all";
  const unreadOnly = url.searchParams.get("unread") === "true";

  const [messages, unreadCounts, channels] = await Promise.all([
    listInboxMessages({ channel, unreadOnly, companyId }),
    getInboxUnreadCounts(companyId),
    Promise.resolve(getIntegrationStatus()),
  ]);

  return NextResponse.json({
    messages,
    unreadCounts,
    channels: {
      whatsapp: channels.whatsapp,
      gmail: channels.gmail,
      email: channels.email,
      sms: channels.sms,
      instagram: channels.instagram,
    },
  });
}

export const GET = loggedRoute("GET /api/inbox", handleGet);
