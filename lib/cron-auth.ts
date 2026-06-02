export function isAuthorizedCronRequest(req: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}
