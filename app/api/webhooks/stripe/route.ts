import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  // Verify with Stripe SDK when STRIPE_SECRET_KEY is configured in production.
  console.info("Stripe webhook received", { bytes: payload.length, signaturePresent: true });

  return NextResponse.json({ received: true });
}

export const POST = loggedRoute("POST /api/webhooks/stripe", handlePost);
