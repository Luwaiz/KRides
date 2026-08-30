# KRides Admin

Internal admin tool for manual driver payouts, refund review, and orphaned
charge reconciliation. Talks to the existing `notification-server` — no
separate backend.

## Local setup

```
cd admin-web
npm install
cp .env.example .env.local   # edit VITE_API_BASE_URL if needed
npm run dev
```

## Backend configuration (one-time, on Render)

Add these two environment variables to the `notification-server` service:

- `ADMIN_API_KEY` — a password for this app. Generate one with, e.g.:
  ```
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```
- `ADMIN_ALLOWED_ORIGINS` — comma-separated list of origins allowed to call
  the `/admin-api/*` routes from a browser. Include your deployed URL and
  `http://localhost:5173` for local dev, e.g.:
  ```
  https://krides-admin.vercel.app,http://localhost:5173
  ```

Without both of these set, `/admin-api/*` returns 503/CORS errors by design.

## Deploying (Vercel or Netlify)

Either platform auto-detects Vite with zero config — just point it at the
`admin-web` directory as the project root:

**Vercel**: New Project → import this repo → set **Root Directory** to
`admin-web` → add environment variable `VITE_API_BASE_URL` (same value as
`.env.example`) → Deploy.

**Netlify**: New site from Git → **Base directory** `admin-web`, **Build
command** `npm run build`, **Publish directory** `admin-web/dist` → add
`VITE_API_BASE_URL` under Environment → Deploy.

After the first deploy, take the URL it gives you and add it to
`ADMIN_ALLOWED_ORIGINS` on Render (see above), then redeploy
`notification-server` so the CORS allowlist picks it up.

## What's here (v1)

- **Payouts** — drivers owed money (mirrors `notification-server/scripts/list-pending-payouts.js`), with a "Mark Paid" button instead of running `mark-payout-paid.js` by hand.
- **Refund Review** — rides where the automatic refund retry gave up after 3 attempts (`needsManualRefundReview`).
- **Orphaned Charges** — card charges where ride creation *and* the automatic refund both failed.

Auth is a single shared password (`ADMIN_API_KEY`), sent as the `x-admin-key`
header, stored in the browser's `localStorage` after login. There's no
per-user accounts or roles — this is meant for one or two trusted operators,
not a public-facing tool.
