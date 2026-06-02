# CRM Elite — Operations Notes

## Database backup

1. Take a logical backup before every production migration:
   ```bash
   mysqldump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M).sql
   ```
2. Store backups off-host (object storage or encrypted archive).
3. Test restore on a staging database at least monthly.

## Migrations

Production deploy order:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start
```

If `AccidentCase_caseNumber_key` fails, deduplicate `AccidentCase.caseNumber` values before re-running migrate.

## Connection pooling

Tune via environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_POOL_LIMIT` | `10` | Max pooled MySQL connections per Node process |
| `DATABASE_QUEUE_LIMIT` | `0` | Queue size when pool is exhausted (`0` = unlimited queue) |

On serverless hosts, keep pool limits low and prefer a managed connection proxy when traffic grows.

## Observability

API routes emit structured JSON logs via `lib/logger.ts`:

```json
{"ts":"...","level":"info","event":"api.request","route":"GET /api/customers","method":"GET","status":200,"durationMs":42}
```

Ship stdout to your log platform (Vercel logs, CloudWatch, Datadog, etc.) and alert on `level=error`.

Middleware logs authenticated API access as `api.access` events.

## Deep linking

CRM sections are addressable with the `section` query param, for example:

- `/?section=accident`
- `/?section=accounting`
- `/?section=renewals-this-month`

Refresh and browser back/forward preserve the active section when possible.
