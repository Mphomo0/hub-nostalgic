# Nostalgic Hub (working name)

A multi-module platform that Nostalgic Studio offers to its clients. **Reviews** (Google
review automation, built from [`review-platform-build-plan.md`](review-platform-build-plan.md))
is the first module; more (e.g. invoicing) will be added as separate modules on the same
foundations: logins, teams, branding, customers and messaging.

**Stack:** Next.js 16 (App Router) · Prisma 7 + Postgres (Neon) · Better Auth · Resend · WhatsApp Cloud API · Inngest · Upstash · React Three Fiber + GSAP

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

### Demo client (to see the client dashboard with data)

```bash
npm run db:seed:demo
```

Creates **Sunrise Hair Studio (demo)** with about 6 weeks of review requests, ratings, private feedback, opt-outs and usage. Log in at `/login` as:

- `demo-owner@example.com` (owner: can change settings and manage the team)
- `demo-staff@example.com` (staff: can send and view)

Both use the `DEMO_PASSWORD` from `.env`. Re-running resets the demo data. It refuses to run in production unless `ALLOW_DEMO_SEED=1`. The demo customers use fake numbers and `@example.com` emails, but don't send real requests from the demo account once WhatsApp/Resend keys are set.

Without API keys the app still works locally:

| Missing | What happens |
|---|---|
| `RESEND_API_KEY` | Emails (invites, review requests) are printed in the terminal running `npm run dev`. Copy the links from there. |
| `WHATSAPP_*` | Customers with phone + email get email instead. Phone-only customers are marked *Failed: WhatsApp isn't available yet*. |
| `INNGEST_*` | Sends happen in the background of the request (no retries). `/api/inngest` returns 500 until `INNGEST_SIGNING_KEY` is set, or `INNGEST_DEV=1` with `npx inngest-cli@latest dev` running. Reminders only run through Inngest. |
| `UPSTASH_*` | In-memory rate limiting (fine for dev, **not** for production). |

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
| `tests/reviews/intake.test.ts` | Every sending rule / skip reason in section 6.2, phone normalisation, channel choice |
| `tests/reviews/delivery.test.ts` | Email/WhatsApp sending, email fallback, retries, paused clients, the reminder job, usage + cap |
| `tests/reviews/public-flow.test.ts` | Rate → Google flow, single-use rating, low-rating feedback, email + WhatsApp STOP opt-outs, webhook signatures, retention |
| `tests/schemas.test.ts` | Shared form schemas accept both browser values and FormData |
| `tests/password-reset.test.ts` | Forgot password: email link, single-use token, min length, sessions revoked, no account probing |
| `tests/logo.test.ts` | Logo resize/re-encode, SVG rejection, 500 KB limit |

## How the code is organised

The platform is split into **shared foundations** (`lib/`) and **modules** (`modules/`). A module never reaches into another module; it only uses the foundations.

```
lib/                     shared by every module
  auth.ts, session.ts      logins (Better Auth), requireMember / requireModule / requireAdmin
  tenant.ts                tenantDb(clientId): the single tenancy-scoping helper
  modules.ts               which modules a client has switched on
  messaging/               email (Resend), WhatsApp, usage counting + monthly cap, email layout
  schemas.ts               platform form schemas (Zod) + shared building blocks
  invites.ts, logo.ts, retention.ts, rate-limit.ts, ...

modules/
  catalog.ts               the list of modules: drives menus, admin, public site
  server.ts                each module's background jobs, dashboard home card, admin panel
  reviews/                 the Reviews module
    module.ts              name, icon, sidebar links, product page
    config.ts              30-day rule, 1–3 star threshold, reminder delay, CSV limit
    lib/                   sending rules, delivery, rating flow, opt-outs, queue
    schemas.ts, emails.ts, jobs.ts, events.ts
    components/            status badges, dashboard home card
    admin/                 the Reviews panel on the admin client page
    marketing/             3D hero + scroll steps for /reviews

prisma/schema/           base · auth · platform · reviews (one .prisma file per area)

app/
  (marketing)/             / (platform home), /reviews (product page), contact, legal
  dashboard/               Home, Account (team, business profile)
  dashboard/reviews/       Reviews pages (guarded by requireModule("reviews"))
  admin/                   clients (with a panel per module), usage
  r/[token], unsubscribe/  public Reviews pages for customers
  api/                     auth, inngest (all modules' jobs), logo, webhooks
```

**Per-client modules:** `ClientModule` rows record which modules each client has. Admin switches them on per client (the Reviews panel asks for the Google link first). The dashboard sidebar and home page only show a client's modules, and module pages/actions call `requireModule(key)`. Switching a module off keeps its data.

### Adding a module (e.g. invoicing)

1. `modules/invoicing/module.ts`: key `"invoicing"`, name, icon, sidebar links under `/dashboard/invoicing`, optional `marketing.href`. Add it to `MODULES` in `modules/catalog.ts` (use `status: "coming-soon"` until it's ready to sell).
2. `prisma/schema/invoicing.prisma`: its tables (with `clientId`), then add those models to the `DIRECT` list in `lib/tenant.ts` and run a migration.
3. `app/dashboard/invoicing/`: a `layout.tsx` calling `requireModule("invoicing")`, plus its pages. Server actions call `requireModule("invoicing")` too and use the `tdb` it returns.
4. `modules/server.ts`: register its Inngest jobs, a home card for `/dashboard`, and an admin panel.
5. Optional: a product page at `app/(marketing)/invoicing/`; it then appears in the header, footer, home page and sitemap automatically.
6. Messaging: use `lib/messaging` (email/WhatsApp, usage, monthly cap, opt-outs) rather than calling providers directly.

## Forgot password

`/login` → **Forgot your password?** → `/forgot-password` emails a link to `/reset-password?token=…` (locally the email is printed in the dev terminal). Links work once and expire after 1 hour; a reset logs the user out everywhere. The page gives the same answer whether or not an email has an account. Both endpoints are rate limited.

## Forms

Every form with user input uses **react-hook-form** with **zodResolver**. The schema for each form lives in `lib/schemas.ts`, and the server action parses the same schema again, so browser and server rules can't drift apart. Server-only errors (e.g. "this email already has a login") are shown on the matching field. Forms that are just a button (pause client, mark handled, remove staff, log out) are plain server-action forms.

## Phase status

| Phase | Status |
|---|---|
| 0. Accounts (Neon, Vercel, Resend domain, Meta, Upstash, Inngest) | **Owner to do**, see below |
| 1. Foundation | Done. Admin creates client → owner invite → set password → dashboard (verified in browser) |
| 2. Dashboard shell | Done. Settings (logo in Neon), Team, paused banner + send block, tenancy tests |
| 3. Intake + rules | Done. Manual form, CSV with preview/row errors + template, all 7 checks, consent log, usage counters |
| 4. Email end to end | Done locally (email printed to console). Needs `RESEND_API_KEY` + verified domain for a real send |
| 5. Dashboard views | Done. Requests (filter, paging), Feedback inbox, Overview with date range |
| 6. Reminders, opt-outs, cap | Done. Daily job, unsubscribe page + RFC 8058 one-click, cap on sends and reminders, admin usage page |
| 7. WhatsApp | Code done (templates, delivery webhooks, STOP, fallback). Untested against Meta until templates are approved |
| 8. Public site + legal | Done. 3D hero (lazy, with SVG fallback), GSAP scroll steps, contact form, Privacy, Terms |
| 9. Pilot | Owner to do |

## Owner to-dos before going live

1. **Neon**: create the project; set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct). Run `npm run db:deploy` then `npm run db:seed`.
2. **Vercel**: import the repo, add all env vars from `.env.example`. Build command is `npm run build` (runs `prisma generate`).
3. **Resend**: verify your sending domain (SPF + DKIM), set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **Inngest**: install the Vercel integration (sets `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`), confirm the app syncs at `/api/inngest`.
5. **Upstash Redis**: set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
6. **WhatsApp** (long lead time):
   - Create templates `review_request` and `review_reminder` (or set `WHATSAPP_TEMPLATE_*`). Body variables: `{{1}}` = customer first name, `{{2}}` = business name, ending with "Reply STOP to opt out." Add one **URL button** with base `https://<your domain>/r/{{1}}` (we pass the request token).
   - Check whether Meta categorises them as **marketing** or **utility** (it drives cost).
   - Webhook URL: `https://<your domain>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`. Set `WHATSAPP_APP_SECRET` so signatures are checked.
7. **Legal**: have the Privacy Policy and Terms reviewed by a South African lawyer (they're drafts).
8. **Platform name + domain**: change `PLATFORM_NAME` in `lib/config.ts` (working name "Nostalgic Hub").

## Decisions and deviations to review

- **Better Auth organisations plugin not used.** Better Auth handles passwords, sessions and login rate limiting; client membership, roles and invites are our own `Membership` / `Invite` tables. The plugin's invitation flow expects the invitee to already have an account, which clashes with "invite email sets the password". The plan allowed adapting to Better Auth's tables; this kept the schema simpler to read.
- **One login = one client** (unique `Membership.userId`). A removed staff member can be re-invited.
- **Invalid contact details skip the row.** If a phone *or* email is given but invalid, the row is skipped (rather than silently using the other channel), so the sender can fix it.
- **Failed sends don't count for the 30-day rule**, so a customer whose message never went out can be retried.
- **Reminders respect the monthly cap** (they count toward usage).
- **WhatsApp STOP** opts the customer out of the client whose message they replied to; if unclear, the client that most recently messaged them.
- **POPIA deletion keeps opt-outs**: deleting an opted-out customer keeps only their phone/email as a do-not-contact record, so a re-upload can't message them again.
- **Retention**: 24 months after the last request, enforced by a monthly job (`RETENTION_MONTHS`). Documented in the Privacy Policy.
- **Enquiries are stored** in the database as well as emailed, so none are lost if email fails.

## Flagged, not built (outside v1 scope)

- **Content Security Policy.** Basic security headers are set; a strict CSP needs nonces for the JSON-LD and 3D scene.
- **Admin view of website enquiries** (they're in the `enquiry` table and emailed to you).
