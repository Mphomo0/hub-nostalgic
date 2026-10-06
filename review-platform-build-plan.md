# Review Automation Platform: Build Instructions

> Working name: **[PRODUCT NAME TBD]** (placeholder `{{PRODUCT_NAME}}` used below)
> Owner: Mpho / Nostalgic Studio
> Purpose of this file: instructions for an AI coding tool (Claude Code, Cursor, Windsurf) to build v1. Build in the phases listed in section 12, in order. Finish and test each phase before starting the next.

---

## 1. What we are building

A paid, white-label review-automation service that Nostalgic Studio offers to its own agency clients (small South African businesses). A client's staff log into a dashboard, send review requests to their customers, and customers are guided to leave a Google review. The product is one flat offering: every subscribed client gets the full system, WhatsApp included.

Longer term this becomes a GoHighLevel-style client-management platform (CRM, lead forms, reporting). **v1 contains only the review system.** Do not build other modules, but keep the code organised so modules can be added later.

### v1 scope

1. **Public frontend:** a simple 3D-enhanced marketing site that explains the system and gets a business owner to make an enquiry.
2. **Admin area (Mpho only):** create clients, send invites, activate/pause clients, see usage.
3. **Client dashboard (login required):** review system only.

### Explicitly out of scope for v1

- Self-service sign-up or online payments (clients are invoiced manually in Zoho Invoice; admin flips the active flag)
- CRM, lead capture forms, reporting, pipeline
- Automatic triggering from client websites (a later module for sites Nostalgic Studio built)
- Per-client WhatsApp numbers
- Published pricing on the public site ("Contact us for pricing")

---

## 2. Locked decisions

| Area | Decision |
|---|---|
| Product model | One flat paid product per client. One `active` flag per client. No tiers, no WhatsApp add-on. |
| Channel | Per customer: WhatsApp if a phone number exists, otherwise email. |
| Accounts | Admin (Mpho) creates each client. No public sign-up. Invite email sets the password. |
| Logins | Multiple logins per client: an owner and invited staff. Every request is recorded against the sender. |
| Customer intake | Manual form and CSV upload. |
| Review flow | Rate-first: **every** customer rates, then **every** customer sees the Google review link. Low raters (1 to 3 stars) are additionally offered a private feedback form. Never hide the Google link from anyone (Google prohibits review gating). |
| Reminders | One automatic reminder 3 days after the request, only to customers who have not responded. Client can switch it off in settings. |
| Consent and opt-out | Consent tick box on every send or CSV upload, opt-out in every message, no repeat contact within 30 days. |
| Pricing on site | "Contact us for pricing." |
| Frontend | Focused 3D (hero scene plus a few scroll moments). All copy is real HTML. |
| Logos | Stored in Neon (not Vercel Blob). |

---

## 3. Tech stack

- **Framework:** Next.js (App Router), TypeScript, hosted on Vercel
- **Database:** Neon Postgres
- **ORM:** Prisma (readable schema; first Postgres project for the owner)
- **Auth:** email and password with admin-created accounts and invite links. Use Better Auth with its organization feature (client = organization; roles: owner, staff) plus a separate platform-admin role. Check current Better Auth docs before implementing, as APIs change.
- **Email:** Resend, sending from a Nostalgic Studio domain with SPF and DKIM configured
- **WhatsApp:** Meta WhatsApp Cloud API called directly (no BSP), one shared Nostalgic Studio number
- **Background jobs:** Inngest (or Upstash QStash) for send queue and retries, plus a daily scheduled job for reminders
- **Image handling:** `sharp` for logo resizing
- **Validation:** Zod on every API input
- **3D frontend:** React Three Fiber (`@react-three/fiber`, `@react-three/drei`), GSAP ScrollTrigger, lazy-loaded
- **Rate limiting:** Upstash Redis (or equivalent) on login, sending and public rating endpoints

---

## 4. Environment variables

```
DATABASE_URL=                 # Neon pooled connection
DIRECT_URL=                   # Neon direct connection (migrations)
BETTER_AUTH_SECRET=
APP_URL=
RESEND_API_KEY=
EMAIL_FROM=                   # e.g. reviews@yourdomain
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=        # webhook verification
WHATSAPP_APP_SECRET=          # verify webhook signatures
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ADMIN_EMAIL=                  # seeds the first platform admin
```

Never commit secrets. Provide a `.env.example`.

---

## 5. Data model (Prisma outline)

Use UUID primary keys, `createdAt`/`updatedAt` on everything. Names below are guidance; adapt to Better Auth's required tables.

- **Client**: `name`, `status` (`ACTIVE` | `PAUSED`), `googleReviewUrl`, `brandColor`, `remindersEnabled` (default true), `monthlyCap` (nullable int), `contactEmail`, `contactPhone`
- **ClientLogo**: `clientId` (unique), `data` (Bytes), `contentType`, `sizeBytes`. Kept separate from Client so normal queries never load image bytes.
- **User** (Better Auth) plus **Membership**: `userId`, `clientId`, `role` (`OWNER` | `STAFF`). A separate flag or role marks platform admins (no client).
- **Customer**: `clientId`, `name`, `phoneE164` (nullable), `email` (nullable), `optedOutAt` (nullable). Unique on (`clientId`, `phoneE164`) and (`clientId`, `email`) where not null.
- **ReviewRequest**: `clientId`, `customerId`, `sentByUserId`, `channel` (`WHATSAPP` | `EMAIL`), `token` (unique, unguessable, 32+ random bytes, URL-safe), `status` (`QUEUED` | `SENT` | `FAILED` | `OPENED` | `RATED` | `CLICKED_GOOGLE`), `rating` (nullable 1 to 5), `sentAt`, `openedAt`, `ratedAt`, `googleClickedAt`, `reminderSentAt`, `consentLogId`
- **Feedback**: `reviewRequestId`, `message`, `handledAt` (nullable), `handledByUserId` (nullable)
- **ConsentLog**: `clientId`, `userId`, `batchLabel`, `statementVersion`, `ip`, `createdAt`. One row per manual send or CSV batch.
- **UsageCounter**: `clientId`, `month` (YYYY-MM), `whatsappCount`, `emailCount`. Unique on (`clientId`, `month`).
- **MessageEvent**: `reviewRequestId`, `provider`, `providerMessageId`, `eventType`, `payload` (JSON), `createdAt`
- **Invite** (if not handled by Better Auth): `clientId`, `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt`

### Multi-tenancy rule (critical)

Every query in the client dashboard must be scoped by the logged-in user's `clientId`, derived from their session on the server. Never trust a `clientId` sent from the browser. Write a single data-access helper that injects the scope, and use it everywhere. Add automated tests proving client A can never read or modify client B's data.

---

## 6. Core flows

### 6.1 Admin creates a client

1. Admin enters business name, Google review link, owner name and email, optional brand colour, optional logo.
2. System creates the Client (status `ACTIVE` or `PAUSED` as chosen) and an owner invite.
3. Resend emails the owner an invite link. They set a password and land in the dashboard.
4. Owner can invite staff from the Team page (same invite mechanism, role `STAFF`).

### 6.2 Sending review requests

Entry points: **manual form** (one customer: name plus phone and/or email) and **CSV upload** (columns: `name`, `phone`, `email`; provide a downloadable template; show a preview and row-level errors before sending).

For every customer row, run these checks in order and record the reason for any skip:

1. Client status is `ACTIVE`
2. Consent box ticked (create `ConsentLog`)
3. Phone is normalised to E.164 (default country South Africa, +27); email is valid
4. At least one of phone or email exists
5. Customer is not opted out for this client
6. No request to this customer from this client in the last **30 days**
7. Client is within `monthlyCap` for the month (if set)

If all pass: create the `ReviewRequest`, enqueue the send job. Channel rule: WhatsApp if `phoneE164` exists, otherwise email. If the WhatsApp send fails permanently and an email exists, fall back to email once.

Show the sender a summary: sent, skipped (with reasons), failed.

### 6.3 Customer rating page (public)

Route: `/r/[token]`. No login. Branded with the client's logo and colour.

1. Open: mark `OPENED`.
2. Customer picks 1 to 5 stars (store rating, mark `RATED`).
3. **Everyone** then sees a clear button to the client's Google review link. Clicking it records `googleClickedAt`.
4. If rating is 1 to 3, also show a private feedback form ("Want to tell us directly so we can put it right?"). Submission creates `Feedback`. The Google link remains visible.
5. Token is single-use for rating (can revisit but not re-rate), rate-limited, and never reveals other data.

### 6.4 Reminder job

Daily scheduled job: find requests where status is `SENT` or `OPENED` (no rating), `sentAt` is at least 3 days ago, `reminderSentAt` is null, client has `remindersEnabled`, client is `ACTIVE`, customer not opted out. Send one reminder via the same channel, set `reminderSentAt`. Counts toward usage.

### 6.5 Opt-out

- **WhatsApp:** inbound webhook. If a customer replies STOP (case-insensitive, trim whitespace), set `optedOutAt` for that customer for the relevant client and stop all further contact.
- **Email:** every email has an unsubscribe link (`/unsubscribe/[token]`) that sets `optedOutAt`.
- Opt-outs are permanent for that client. Re-uploading the same customer must not re-enable contact.

### 6.6 Active / paused

When a client is `PAUSED`: dashboard login still works but sending is disabled with a clear banner, queued jobs and reminders for that client are skipped. Admin toggles this manually when invoicing status changes. Consider a short "overdue" grace state later (not v1).

---

## 7. Dashboard pages (client side)

- **Overview:** requests sent, ratings received, average rating, Google link clicks, simple date range
- **Send requests:** manual form and CSV upload (section 6.2)
- **Requests:** list with status, channel, sender, timestamps; filter by status
- **Feedback inbox:** private feedback from low raters; mark handled
- **Team:** owner can invite and remove staff
- **Settings:** business name, Google review link, logo upload, brand colour, reminders on/off

## 8. Admin pages (Mpho only)

- **Clients:** list, create, edit, activate/pause
- **Client detail:** users, usage this month (WhatsApp and email counts), recent requests
- **Usage overview:** per-client monthly counts so WhatsApp costs can be monitored; set `monthlyCap` per client

---

## 9. Logos in Neon

- Accept PNG, JPG, WebP only. **Reject SVG** (can carry scripts).
- Max upload 500 KB. Resize with `sharp` to a maximum width of 400px and re-encode (e.g. WebP or PNG) so the stored file is always small.
- Store in `ClientLogo` (`bytea`), separate from `Client`.
- Serve via `GET /api/logo/[clientId]` with long `Cache-Control` and an ETag so Vercel's CDN absorbs repeat requests. Use a cache-busting query param (e.g. `?v=updatedAt`) when the logo changes.
- Email templates reference this public URL.

---

## 10. WhatsApp setup (start on day one; it has lead time)

- Create and verify a Meta Business account; register the shared phone number; set up the Cloud API app and webhook.
- Create message templates (request and reminder) with variables for customer name and client business name, plus a STOP instruction. Templates need Meta approval (days to weeks).
- Review requests may be categorised as **marketing** (higher cost) rather than utility. Confirm the category when creating the template, as this drives the cost behind the flat fee.
- Verify webhook signatures using the app secret. Handle delivery status events (store in `MessageEvent`) and inbound messages (STOP handling).
- Because all clients share one number, complaints against it affect everyone. The consent, opt-out and 30-day rules in section 6 exist to protect it. Do not weaken them.

## 11. Security and compliance

- Server-side tenancy scoping on every query (section 5), with tests
- Rate limiting on login, invite acceptance, sending and all public routes
- Unguessable tokens; hash invite tokens at rest
- Validate and sanitise all CSV input; cap rows per upload (e.g. 500)
- Security headers and CSRF protection per Next.js and Better Auth defaults
- POPIA: store only what is needed; provide an admin route to delete a customer's data on request; define and document a retention period; log consent
- Public pages: **Privacy Policy** and **Terms** (include the consent wording clients agree to when sending requests)
- Audit-friendly: keep `ConsentLog` and `MessageEvent` records

---

## 12. Build phases

Complete and test each phase before moving on. Email is built end to end before WhatsApp so the product works while Meta approval is pending.

**Phase 0: Accounts and setup (owner, start immediately)**
Neon project, Vercel project, Resend domain (SPF/DKIM), Meta Business verification, WhatsApp number and template submission, Upstash and Inngest accounts.

**Phase 1: Foundation**
Next.js project, Prisma schema and migrations, Better Auth with organizations, seed the platform admin, admin area to create clients and send owner invites. *Done when:* admin can create a client and the owner can accept the invite and log in.

**Phase 2: Dashboard shell**
Layout, navigation, Settings page (including logo upload per section 9), Team page (invite/remove staff), active/paused enforcement. *Done when:* two test clients exist and tests prove neither can see the other's data.

**Phase 3: Customer intake and sending rules**
Manual form, CSV upload with preview and errors, phone normalisation, all checks in 6.2, consent logging, usage counters. *Done when:* every skip reason is exercised by a test.

**Phase 4: Email path end to end**
Resend sending via the queue, branded email template with logo and unsubscribe link, public rating page `/r/[token]`, Google link, private feedback form. *Done when:* a real email goes out and the full rate-then-Google flow works.

**Phase 5: Dashboard views**
Requests list, Feedback inbox, Overview numbers.

**Phase 6: Reminders, opt-outs, usage cap**
Daily reminder job, unsubscribe link handling, `monthlyCap` enforcement, admin usage overview.

**Phase 7: WhatsApp**
Cloud API sending, approved templates, delivery webhooks, STOP handling, channel selection and email fallback. Begin once templates are approved.

**Phase 8: Public 3D site and legal pages**
See section 13.

**Phase 9: Testing and pilot**
End-to-end tests, load a realistic CSV, pilot with one real client, then roll out. Review WhatsApp quality rating and real per-client costs, then set `monthlyCap` defaults.

---

## 13. Public frontend (3D, focused)

Principles:

- **All content is real HTML text**: headings, copy, FAQs, structured data (Organization, Service). The 3D layer is decoration on top, never the only place information lives. Search engines and AI assistants must be able to read everything.
- **Performance first:** load the page content immediately and lazy-load the 3D scene after. Target a good mobile score; many visitors will be on mid-range phones over mobile data. Keep models and textures small and compressed.
- **Fallbacks:** static image/SVG version for devices without WebGL, low-power devices, and `prefers-reduced-motion`.
- **Accessibility:** meaningful alt text, keyboard-friendly navigation, sufficient contrast.

Pages:

- **Home:** plain-language headline (e.g. "Get more Google reviews from your happy customers, automatically"), how it works (send, rate, review), who it is for, a call to action
- **Contact / Get started:** short enquiry form that emails Mpho (with spam protection), optional WhatsApp link, "Contact us for pricing"
- **Login** link in the header
- **Privacy Policy** and **Terms**

3D elements (keep it to these):

1. **Hero scene:** a floating phone or card showing a review request arriving and the stars filling in
2. **Scroll moments** in the how-it-works section, triggered with GSAP ScrollTrigger, tied to the three steps

Do not build a fully immersive 3D navigation experience.

---

## 14. Values to confirm or set

| Item | Current default |
|---|---|
| Repeat-contact period | 30 days |
| Low-rating threshold for feedback form | 1 to 3 stars |
| Reminder delay | 3 days, one reminder only |
| Monthly cap per client | **Unset.** Decide after real WhatsApp costs are known |
| CSV row limit per upload | 500 |
| Product name and domain | **TBD** |

---

## 15. General instructions for the coding tool

- Build one phase at a time; summarise what was built and how to test it at the end of each.
- Prefer simple, readable code with comments where logic is non-obvious (the owner is newer to Postgres and TypeScript).
- Do not add features outside v1 scope. If something seems necessary, flag it instead of building it.
- Check current documentation for Better Auth, Meta WhatsApp Cloud API, Resend and Inngest before implementing, as APIs change.
- Write tests for tenancy isolation, sending rules, opt-out handling and the reminder job.
