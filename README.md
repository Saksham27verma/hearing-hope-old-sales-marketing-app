# Hearing Hope — Customer Lifecycle

Standalone app for legacy Zoho sales (~1,700+ rows), sale-anniversary reminders, and WhatsApp marketing via **hearing-hope-crm** (Pinnacle gateway).

## Stack

- Next.js 15 + MUI
- Turso (SQLite) + Drizzle ORM
- Vercel cron (daily 9:00 AM IST)

## Local setup

```bash
cd hearing-hope-customer-lifecycle
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3001
```

Default local DB: `file:./local.db` (no Turso account required).

### Env (`.env.local`)

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | `file:./local.db` or Turso URL |
| `TURSO_AUTH_TOKEN` | Turso token (if remote) |
| `LIFECYCLE_ADMIN_PASSWORD` | Login password |
| `CRM_BASE_URL` | e.g. `http://localhost:3000` |
| `CRM_WEBHOOK_SECRET` | Same as `LIFECYCLE_WEBHOOK_SECRET` in CRM |
| `TOKEN_SIGNING_SECRET` | Shared with CRM for SSO links |
| `LIFECYCLE_APP_URL` | e.g. `http://localhost:3001` |

## CSV import

Headers: `customerName,phone,reference,saleDate,address,centerId,notes`

Use **Sales → Import CSV** or `sample-legacy-sales.csv`.

## CRM integration

- **Notifications:** daily cron → `POST {CRM}/api/notifications/sale-milestone`
- **WhatsApp:** `POST {CRM}/api/lifecycle/whatsapp/send-one` and `send-batch`
- Pinnacle keys stay in CRM only.

## Cron

`GET /api/cron/daily-milestones` — configured in `vercel.json` (03:30 UTC ≈ 9:00 IST).

Local test:

```bash
curl http://localhost:3001/api/cron/daily-milestones
```

## Turso (production)

1. Create DB at [turso.tech](https://turso.tech)
2. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local`
3. **Important:** use a **database token**, not an organization token:
   ```bash
   turso db tokens create hearing-hope-whatsapp-marketing-database
   ```
   Or in the Turso dashboard: open your database → **Create Token** (database-scoped).
4. Restart the dev server after updating `.env.local`
5. Deploy to Vercel with the same env vars

## Pages

- `/dashboard` — due today, notifications
- `/sales` — list, add, edit, WhatsApp
- `/sales/import` — CSV bulk import
- `/whatsapp/bulk` — message all due today
- `/settings` — milestone rules
