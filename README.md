# Nostalgic Hub

A multi-module platform that Nostalgic Studio offers to its clients. **Reviews** (Google
review automation, built from [`review-platform-build-plan.md`](review-platform-build-plan.md))
is the first module; more (e.g. invoicing) will be added as separate modules on the same
foundations: logins, teams, branding, customers and messaging.

**Live:** https://hub.example.com

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 + Postgres (Neon) · Better Auth · Resend · WhatsApp Cloud API · Inngest · Upstash Redis · React Three Fiber + GSAP · hosted on Vercel

---

## Contents

1. [Run it locally](#run-it-locally)
2. [Production setup](#production-setup)
3. [Environment variables](#environment-variables)
4. [WhatsApp setup](#whatsapp-setup)
5. [Operations: monitoring, alerts and troubleshooting](#operations)
6. [Tests](#tests)
7. [How the code is organised](#how-the-code-is-organised)
8. [Product features](#product-features)
9. [Decisions to review](#decisions-and-deviations-to-review)

---

## Run it locally

```bash
npm install
cp .env.example .env          # then fill in values (see below)
npx prisma dev -n nostalgic --detach        # local Postgres; put the printed URL in DATABASE_URL + DIRECT_URL
npx prisma dev -n nostalgic-test --detach   # second, throwaway Postgres for tests → TEST_DATABASE_URL
npm run db:migrate            # create tables
npm run db:seed               # creates the platform admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```

Log in at `/login` with the admin account, then go to `/admin`.

`npm run dev` and `npm test` start the local databases for you (they stop when your computer restarts). If you see "Something went wrong on our side" when logging in locally, the database isn't running: run `npx prisma dev start nostalgic`. Run `npm run db:migrate` after pulling changes.

> **Local `.env` and production.** Keep local database URLs in `.env` for development. Do not point `DATABASE_URL` at the production Neon database while developing, and never run `db:seed:demo` or the tests against it.

### Demo client (to see the client dashboard with data)

```bash
npm run db:seed:demo
```

Creates **Sunrise Hair Studio (demo)** with about 6 weeks of review requests, ratings, private feedback, opt-outs and usage. Log in at `/login` as:

- `demo-owner@example.com` (owner: can change settings and manage the team)
- `demo-staff@example.com` (staff: can send and view)

Both use the `DEMO_PASSWORD` from `.env`. Re-running resets the demo data. It refuses to run in production unless `ALLOW_DEMO_SEED=1`. The demo customers use fake numbers and `@example.com` emails, but don't send real requests from the demo account once WhatsApp/Resend keys are set.

### What works without API keys

| Missing | What happens |
|---|---|
| `RESEND_API_KEY` | Emails (invites, review requests) are printed in the terminal running `npm run dev`. Copy the links from there. |
| `WHATSAPP_*` | Customers with phone + email get email instead. Phone-only customers are marked *Failed: WhatsApp isn't available yet*. |
| `INNGEST_*` | Sends happen in the background of the request (no retries). `/api/inngest` returns 500 until `INNGEST_SIGNING_KEY` is set, or `INNGEST_DEV=1` with `npx inngest-cli@latest dev` running. Reminders only run through Inngest. |
| `UPSTASH_*` / `KV_REST_API_*` | In-memory rate limiting (fine for dev, **not** for production). |

---

## Production setup

Everything below is already set up. This section records how it was done, so it can be repeated or audited.

| Part | Service | Notes |
|---|---|---|
| Hosting | **Vercel**, project `your-vercel-project` | The GitHub repo `your-github-user/your-repo` is connected: **every push to `main` deploys to production.** |
| Domain | `hub.example.com` | DNS lives at the registrar's cPanel zone (`dns-host.example`), not Vercel. One `A` record: `hub` → `203.0.113.10`. (Vercel also recommends a project-specific CNAME; the A record keeps working.) |
| Database | **Neon** Postgres | `DATABASE_URL` = pooled host (`…-pooler…`), `DIRECT_URL` = direct host. Both use `sslmode=verify-full`. Migrations run through `DIRECT_URL`. |
| Email | **Resend** | Domain `example.com` verified (SPF/DKIM in DNS). `EMAIL_FROM` is `Reviews <reviews@example.com>`. |
| Background jobs | **Inngest** (Vercel integration) | App id `review-platform`, synced at `/api/inngest`. Hobby (free) plan. |
| Rate limiting | **Upstash Redis** (Vercel integration) | Free plan, `autoUpgrade` off. The integration sets `KV_REST_API_*`; the code accepts those and `UPSTASH_REDIS_REST_*`. |
| WhatsApp | **Meta WhatsApp Cloud API** | See [WhatsApp setup](#whatsapp-setup). |
| Uptime | **UptimeRobot** (free) | Checks `/api/health` every 5 minutes, emails on failure and recovery. |

### Deploying

- **Normal:** `git push origin main`. Vercel builds (`prisma generate && next build`) and deploys. The live site updates within about a minute.
- **Manual:** `vercel deploy --prod` from the project folder.
- **Environment variables only apply to new deployments.** After changing one in Vercel, redeploy.
- **Database changes:** create the migration locally (`npm run db:migrate`), commit it, then apply it to production with `npm run db:deploy` while `DIRECT_URL` points at Neon. Back up first if the migration drops or rewrites data.

There is no staging environment: pushes to `main` go straight to production. Before pushing, run:

```bash
npx tsc --noEmit && npx eslint . && npm test && npx next build
```

Preview deployments (non-`main` branches) are not configured: they would have no env vars and would need their own Neon branch, so that previews never touch real customers.

### Creating the first admin

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=choose-one npm run db:seed
```

with `DATABASE_URL` / `DIRECT_URL` pointing at the target database. If `ADMIN_PASSWORD` is empty, a password is generated and printed once.

---

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables) for **Production**, and in `.env` locally. The full commented list is in [`.env.example`](.env.example). Never commit real values.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string. |
| `DIRECT_URL` | yes | Neon **direct** connection string (migrations). |
| `BETTER_AUTH_SECRET` | yes | Random secret: `openssl rand -base64 32`. |
| `APP_URL` | yes | `https://hub.example.com`, no trailing slash. Used in every email link. |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | Sending email. |
| `ADMIN_EMAIL` | yes | Receives the hourly failed-send alert; also the default enquiry recipient. |
| `WHATSAPP_ACCESS_TOKEN` | for WhatsApp | Permanent system-user token. **Secret.** |
| `WHATSAPP_PHONE_NUMBER_ID` | for WhatsApp | From Meta, WhatsApp → API setup. |
| `WHATSAPP_APP_SECRET` | for WhatsApp | Meta app → Settings → Basic → App secret. Webhooks are rejected without it. **Secret.** |
| `WHATSAPP_VERIFY_TOKEN` | for WhatsApp | Any random string; the same value is entered in Meta's webhook settings. |
| `WHATSAPP_TEMPLATE_REQUEST`, `WHATSAPP_TEMPLATE_REMINDER`, `WHATSAPP_TEMPLATE_LANG` | optional | Default `review_request`, `review_reminder`, `en`. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | yes | Set by the Inngest Vercel integration. |
| `INNGEST_MONTHLY_EXECUTIONS` | optional | Plan limit used by the `/admin/usage` warning. Currently `50000`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Set by the Upstash Vercel integration. |
| `TEST_DATABASE_URL` | local only | A **separate** throwaway database for tests. Never set it in Vercel. |
| `DEMO_PASSWORD` | local only | Never set it in production. |

Mark secrets as **sensitive** in Vercel (`vercel env add NAME production --sensitive`). Sensitive values can't be read back, so keep your own copy somewhere safe (a password manager).

---

## WhatsApp setup

Messages are sent from one shared number as **template messages**, so each template must be approved by Meta.

### Meta side (one-off)

1. A Meta app with the **WhatsApp** use case, and a WhatsApp Business account (WABA) with a registered number. The free test number only sends to 5 verified recipients: use a real number for production.
2. A payment method on the WABA (Business Settings → Billing & payments). Without one, sends fail with *"Business eligibility payment issue"*.
3. **Webhook:** Callback URL `https://hub.example.com/api/webhooks/whatsapp`, Verify token = `WHATSAPP_VERIFY_TOKEN`. Subscribe the **`messages`** field, and turn on **Subscribe webhooks** for the WhatsApp account.
4. Publish the app (App mode Live) with a privacy policy URL, terms URL, data deletion URL, category and icon.
5. A permanent access token from a system user (needs identity verification by Meta), and the **App secret**.

### Templates

Create both in WhatsApp Manager → Message templates. Category **Utility**, language **English** (`en`), type **Default**.

**`review_request`** body:

```
Hi {{1}}, thanks for choosing {{2}}! We'd love to hear how your experience was. It takes less than a minute.

Reply STOP to opt out.
```

**`review_reminder`** body:

```
Hi {{1}}, a quick reminder from {{2}}: we'd still love your feedback on your recent visit. It only takes a minute.

Reply STOP to opt out.
```

Samples for both: `{{1}}` = `Thandi`, `{{2}}` = `Sunrise Hair Studio`.

**Button** (both templates): type *Visit website*, text `Rate your experience`, URL type **Dynamic**.

> **The Website URL box must contain the base only:** `https://hub.example.com/r/`
> Meta shows the `{{1}}` variable beside the box by itself. If you type `{{1}}` inside the box as well, links go out as `/r/{{1}}<token>`. The app strips that prefix so such links still work, but the template should be fixed.
> Sample URL: `https://hub.example.com/r/abc123xyz` (a complete URL).

Body variables: `{{1}}` = customer first name, `{{2}}` = client business name. The "Reply STOP" line must stay: an inbound `STOP` opts the customer out.

---

## Operations

### Monitoring

| What | How | Alerts |
|---|---|---|
| Site and database up | `GET /api/health` returns `200 {"status":"ok"}` or `503`. UptimeRobot checks it every 5 minutes. | Email to the account owner |
| Failed or stuck sends | Inngest job `failed-sends-alert`, every hour. Reports requests that failed in the last hour, and requests stuck in the queue for 30+ minutes. Sends nothing when all is well. | Email to `ADMIN_EMAIL` |
| Failures per client | `/admin` has a **Failed (24h)** column. Each client's Reviews overview warns about failures in the last 7 days. | In-app |
| Inngest usage | `/admin/usage` shows an estimate of runs and steps against `INNGEST_MONTHLY_EXECUTIONS`. | In-app (amber at 70%, red at 90%) |

The usage figure is an estimate from messages sent. The real number is in the Inngest dashboard (Usage).

### If Inngest refuses events

`enqueueSends` falls back to sending directly in the background of the request (no retries), and logs `[queue] Inngest refused the events; sending directly instead`. Sends keep working; only automatic retries are lost.

### Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Requests stay **Queued** | Inngest isn't running the function. Check Inngest → Apps: `review-platform` must be listed with its functions. Re-sync with `https://hub.example.com/api/inngest`. Events sent before a sync are not replayed: replay them from Inngest → Events. |
| **Failed: WhatsApp … Business eligibility payment issue** | Meta can't charge the WABA. Check Business Settings → Billing & payments (card valid, international USD payments allowed by the bank). New cards can take a few hours. Failed requests don't block a resend. |
| **Failed: … template … does not exist** | Template name or language doesn't match. Check `WHATSAPP_TEMPLATE_*` and that the template is Active in `en`. |
| Rating page says "Page not found" from WhatsApp | Template URL button has `{{1}}` typed inside the URL box. See [Templates](#templates). |
| Customer skipped: *Already contacted in the last 30 days* | The 30-day rule counts any non-failed request. Use a different contact, or delete the test customer in Admin → client → *Delete a customer's data*. |
| Webhooks return 401 | `WHATSAPP_APP_SECRET` is missing or wrong, or Meta's *Subscribe webhooks* is off. |
| WhatsApp verification fails in Meta | `WHATSAPP_VERIFY_TOKEN` in Vercel differs from the one entered in Meta, or the deployment doesn't have the latest value yet. |
| Email invite links point to the wrong address | `APP_URL` is wrong. Fix it and redeploy. |
| No emails arrive | Check `RESEND_API_KEY` / `EMAIL_FROM`, and the domain status in Resend. |
| Logging in fails locally | Local database isn't running: `npx prisma dev start nostalgic`. |

### Reading the production logs

```bash
vercel logs --environment production --since 30m --no-branch
vercel logs --environment production --since 2h --no-branch --level error --expand
```

Useful lines: `POST /dashboard/reviews/send` (a send was submitted), `POST /api/inngest` (a job ran), `POST /api/webhooks/whatsapp` (Meta status events), `GET /r/<token>` (the customer opened the rating page), `GET /r/<token>/go` (they tapped through to Google).

---

## Tests

```bash
npm test
```

Tests need `TEST_DATABASE_URL` pointing at a **separate** database: they delete all data, and refuse to run if it matches `DATABASE_URL`.
(Note: `prisma dev` serves a single database per server, so the test DB must be its own `prisma dev` instance.)

| File | Covers |
|---|---|
| `tests/tenancy.test.ts` | Client A can never read, update, delete or create into client B's data |
| `tests/modules.test.ts` | Module switch: menus, sending, reminders and tenancy all respect it |
| `tests/reviews/intake.test.ts` | Every sending rule / skip reason, phone normalisation, channel choice |
| `tests/reviews/delivery.test.ts` | Email/WhatsApp sending, email fallback, retries, paused clients, the reminder job, usage + cap |
| `tests/reviews/public-flow.test.ts` | Rate → Google flow, single-use rating, low-rating feedback, email + WhatsApp STOP opt-outs, webhook signatures, retention |
| `tests/reviews/customers.test.ts` | Customers page filters, status roll-up, search, tenancy, CSV helpers |
| `tests/reviews/alerts.test.ts` | Failed/stuck collector and the alert email digest |
| `tests/queue-fallback.test.ts` | Falls back to direct sending when Inngest refuses events |
| `tests/inngest-usage.test.ts` | Inngest usage estimate and thresholds |
| `tests/tokens.test.ts` | Leftover `{{1}}` is stripped from public links |
| `tests/health.test.ts` | `/api/health` |
| `tests/schemas.test.ts` | Shared form schemas accept both browser values and FormData |
| `tests/password-reset.test.ts` | Forgot password: email link, single-use token, min length, sessions revoked, no account probing |
| `tests/logo.test.ts` | Logo resize/re-encode, SVG rejection, 500 KB limit |

---

## How the code is organised

The platform is split into **shared foundations** (`lib/`) and **modules** (`modules/`). A module never reaches into another module; it only uses the foundations.

```
lib/                     shared by every module
  auth.ts, session.ts      logins (Better Auth), requireMember / requireModule / requireAdmin
  tenant.ts                tenantDb(clientId): the single tenancy-scoping helper
  modules.ts               which modules a client has switched on
  messaging/               email (Resend), WhatsApp, usage counting + monthly cap, email layout
  inngest/                 client, platform jobs, usage estimate
  schemas.ts               platform form schemas (Zod) + shared building blocks
  invites.ts, logo.ts, retention.ts, rate-limit.ts, tokens.ts, dates.ts, ...

modules/
  catalog.ts               the list of modules: drives menus, admin, public site
  server.ts                each module's background jobs, dashboard home card, admin panel
  reviews/                 the Reviews module
    module.ts              name, icon, sidebar links, product page
    config.ts              30-day rule, 1–3 star threshold, reminder delay, CSV limit
    lib/                   sending rules, delivery, rating flow, opt-outs, queue, customers, alerts
    schemas.ts, emails.ts, jobs.ts, events.ts
    components/            status badges, dashboard home card
    admin/                 the Reviews panel on the admin client page
    marketing/             3D hero + scroll steps for /reviews

prisma/schema/           base · auth · platform · reviews (one .prisma file per area)

app/
  (marketing)/             / (platform home), /reviews (product page), contact, legal
  dashboard/               Home, Account (team, business profile)
  dashboard/reviews/       Overview, Send, Customers, Requests, Feedback, Settings
                           (guarded by requireModule("reviews"))
  admin/                   clients (with a panel per module), usage
  r/[token], unsubscribe/  public Reviews pages for customers
  api/                     auth, inngest (all modules' jobs), logo, health, webhooks
components/              shared UI (Button, Card, Table, ConfirmAction, ...)
```

**Per-client modules:** `ClientModule` rows record which modules each client has. Admin switches them on per client (the Reviews panel asks for the Google link first). The dashboard sidebar and home page only show a client's modules, and module pages/actions call `requireModule(key)`. Switching a module off keeps its data.

### Adding a module (e.g. invoicing)

1. `modules/invoicing/module.ts`: key `"invoicing"`, name, icon, sidebar links under `/dashboard/invoicing`, optional `marketing.href`. Add it to `MODULES` in `modules/catalog.ts` (use `status: "coming-soon"` until it's ready to sell).
2. `prisma/schema/invoicing.prisma`: its tables (with `clientId`), then add those models to the `DIRECT` list in `lib/tenant.ts` and run a migration.
3. `app/dashboard/invoicing/`: a `layout.tsx` calling `requireModule("invoicing")`, plus its pages. Server actions call `requireModule("invoicing")` too and use the `tdb` it returns.
4. `modules/server.ts`: register its Inngest jobs, a home card for `/dashboard`, and an admin panel.
5. Optional: a product page at `app/(marketing)/invoicing/`; it then appears in the header, footer, home page and sitemap automatically.
6. Messaging: use `lib/messaging` (email/WhatsApp, usage, monthly cap, opt-outs) rather than calling providers directly.

### Forms

Every form with user input uses **react-hook-form** with **zodResolver**. The schema for each form lives in `lib/schemas.ts`, and the server action parses the same schema again, so browser and server rules can't drift apart. Server-only errors (e.g. "this email already has a login") are shown on the matching field. Destructive actions (remove staff, cancel invite, remove logo, pause client, delete customer data) use `ConfirmAction`, a two-step `<details>` panel that works without JavaScript.

---

## Product features

### Sending review requests

- **Send requests:** one customer, or a CSV (up to the row limit). The CSV is parsed in the browser; **the file itself is never uploaded or stored**. Only the validated rows (name, phone, email) and the file name reach the server.
- **Rules**, in order: client active and module on · consent ticked · valid phone/email · not opted out · not contacted in the last 30 days (failed sends don't count) · within the monthly cap.
- **Channel:** WhatsApp when there's a phone number, email otherwise (and as a fallback if WhatsApp fails).
- **Reminders:** one reminder after 3 days to people who haven't rated, daily at 09:00 (SA time).

### Customers page

Reviews → **Customers** lists everyone a client has contacted:

- **Went to Google**: tapped through to the Google review page. (We can't see whether they finished posting a review there.)
- **Not reviewed yet**: sent a request, no Google visit, not opted out.
- **Opted out**, and **Not sent**.
- Search by name, phone or email; **Send request** per customer (same rules and a consent confirmation); **Export CSV** of the current tab and search.

### Opt-outs and POPIA

- Customers can reply **STOP** on WhatsApp or use the unsubscribe link in email. Opt-outs are permanent for that client.
- Admin → client → *Delete a customer's data* removes a customer and their requests (keeping only a do-not-contact record if they had opted out).
- Retention: 24 months after the last request, enforced by a monthly job (`RETENTION_MONTHS`).

### Forgot password

`/login` → **Forgot your password?** → `/forgot-password` emails a link to `/reset-password?token=…` (locally the email is printed in the dev terminal). Links work once and expire after 1 hour; a reset logs the user out everywhere. The page gives the same answer whether or not an email has an account. Both endpoints are rate limited.

---

## Decisions and deviations to review

- **Better Auth organisations plugin not used.** Better Auth handles passwords, sessions and login rate limiting; client membership, roles and invites are our own `Membership` / `Invite` tables. The plugin's invitation flow expects the invitee to already have an account, which clashes with "invite email sets the password".
- **One login = one client** (unique `Membership.userId`). A removed staff member can be re-invited.
- **Invalid contact details skip the row.** If a phone *or* email is given but invalid, the row is skipped (rather than silently using the other channel), so the sender can fix it.
- **Failed sends don't count for the 30-day rule**, so a customer whose message never went out can be retried.
- **Reminders respect the monthly cap** (they count toward usage).
- **WhatsApp STOP** opts the customer out of the client whose message they replied to; if unclear, the client that most recently messaged them.
- **POPIA deletion keeps opt-outs**: deleting an opted-out customer keeps only their phone/email as a do-not-contact record, so a re-upload can't message them again.
- **Enquiries are stored** in the database as well as emailed, so none are lost if email fails.
- **No staging environment.** Pushes to `main` deploy to production; previews aren't configured.
- **Public rating links tolerate a leftover `{{1}}`** in front of the token, as a safety net for template mistakes.

## Still to do / flagged

- **Legal:** have the Privacy Policy and Terms reviewed by a South African lawyer (they're drafts).
- **Content Security Policy:** basic security headers are set; a strict CSP needs nonces for the JSON-LD and 3D scene.
- **Admin view of website enquiries** (they're in the `enquiry` table and emailed to you).
- **Preview deployments:** a Neon branch and Preview env vars, if branch/PR workflows are adopted.
- **CI:** no GitHub Actions yet; tests run locally before pushing.
- **Meta Business Verification:** submitted; check the messaging limits page once approved.
