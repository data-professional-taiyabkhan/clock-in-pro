# Clock-In Pro

Face-verified, geofenced attendance with rotas and lateness tracking for UK SMBs with hourly staff. Stops buddy-punching, flags late arrivals and no-shows, and bills per active employee after a free first month.

Employees clock in and out by looking at their phone. The app matches their face against a registered descriptor, checks their GPS position against the sites they are assigned to, compares the clock-in with their scheduled shift, and records the event. Admins get a live overview (who is in, who is late, who has not turned up), a weekly rota built from contracts set once, a branded employee login link, and Stripe billing with a 30-day free month.

**Live at:** [clockinpro.autostrata.ai](https://clockinpro.autostrata.ai) · **Launching?** Follow [`LAUNCH.md`](LAUNCH.md).

---

## What's in the box

| Area | What it does |
|---|---|
| **Clock-in** | Face verification (on-device detection, server-side match) or a PIN. Geofenced to assigned sites; staff with no sites can clock in anywhere. |
| **Rota** | Weekly contracts per employee set once (e.g. 08:00–12:00 Mon–Thu and Sat), one-off shifts, cancellations, overnight shifts. |
| **Lateness** | Admin-set grace period. Late, no-show, left-early and on-shift status on the overview, the rota and every attendance row. |
| **Branding** | Each organisation's login link (`/org/<slug>`) carries its logo, colour, wallpaper and welcome text; the logo also shows in the employee app. |
| **Billing** | Card at signup via Stripe Checkout, 30 days free, then £3.50 (monthly) or £3.00 (annual) per active employee. Admin seats free. Seat count synced automatically. |
| **People** | Add employees with a one-time password or invite by email. Deactivate (keeps history, frees the seat) or delete permanently. |
| **Theme** | Light and dark with a toggle; one token palette across marketing pages and dashboards. |

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20, TypeScript |
| **Server** | Express 4, express-session + passport-local |
| **Database** | PostgreSQL (Neon `@neondatabase/serverless` in prod) |
| **ORM** | Drizzle ORM + drizzle-kit |
| **Frontend** | React 18, Vite 5 |
| **UI** | shadcn/ui, Tailwind CSS, Framer Motion |
| **State** | TanStack Query v5 |
| **Routing** | Wouter |
| **Billing** | Stripe (Checkout, Customer Portal, Webhooks) |
| **Face Detection** | face-api.js (browser-side) |
| **Face Matching** | Euclidean distance on raw face-api.js descriptors (server-side, threshold 0.6) |
| **Scheduling** | `server/lib/scheduling.ts` + `server/lib/time.ts` (DST-safe, org timezone) |
| **Theme** | Tailwind tokens (HSL), next-themes light/dark |
| **Deployment** | Railway (Nixpacks) |

---

## How Face Matching Actually Works

There is **no cloud face-recognition API** involved. No AWS Rekognition, no Azure Face, no per-match cost.

### Registration (Settings → Clock-In Settings → Set up face verification)
1. The employee grants biometric consent, then opens the face-training flow (`client/src/components/advanced-face-training.tsx`).
2. **face-api.js** (running entirely in the browser; model weights are served from `client/public/models/`) detects the face and extracts a 128-dimensional descriptor for three poses: centre, turned left, turned right. Detections run one at a time, so the loop never piles up on slow phones.
3. The three descriptors are posted to `POST /api/register-face`. The server accepts **only** well-formed descriptors (exactly 128 finite numbers each) — anything else is rejected with a 400 so malformed data can never be stored.
4. The server averages the poses into one centroid and stores it **raw (un-normalised)** in `users.faceEmbedding`. This flow stores no face image.

### Clock-In / Clock-Out
1. The dashboard captures a webcam frame, runs face-api.js locally to extract a probe descriptor, and posts it to `POST /api/verify-face` together with the frame and GPS position.
2. The server computes the plain **Euclidean distance between the raw stored centroid and the raw probe descriptor**.
3. The match is accepted when the distance is ≤ `FACE_MATCH_THRESHOLD` (default **0.6**, face-api.js's standard threshold). Measured with the shipped models: same person 0.3–0.5, different people 0.75–0.9.
4. Geofencing (if the employee has assigned locations) and audit logging apply as before.

> **Do not L2-normalise descriptors before comparing.** face-api.js descriptors have a norm of ≈1.4, so normalising shrinks every distance by ≈30% and the 0.6 threshold then accepts different people. The helpers live in one place, [`server/lib/face-descriptor.ts`](server/lib/face-descriptor.ts), so this cannot drift again.

### What it does not do (yet)
- **No liveness / anti-spoofing.** `performLivenessDetection` in `server/routes.ts` is a stub that always passes; a printed photo held to the camera will match. Use PIN clock-in where that matters.
- **No fallback matching.** If face-api.js cannot detect a face, registration and verification fail cleanly. There is no colour-histogram or "basic" descriptor path.

### Why this approach?
- **Zero per-match cost** — all computation is local.
- **Privacy** — face data never leaves your infrastructure.
- **Simplicity** — no cloud credentials to manage for face matching.
- **Speed** — browser-side detection is near-instant; server comparison is a single 128-element loop.

---

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database (local or [Neon](https://neon.tech) for serverless)

### 1. Clone and install

```bash
git clone <repository-url>
cd AttendanceFaceSyncWeb
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Session secret (required — use a random 64+ character string)
SESSION_SECRET=your-random-secret

# Environment
NODE_ENV=development
PORT=5000

# Stripe billing (required for subscriptions)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_ANNUAL=price_...

# Transactional email (required for invitations — Task 2)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Face matching (optional — max descriptor distance to accept, default 0.6)
FACE_MATCH_THRESHOLD=0.6

# Public URL used in emails and Stripe redirects
APP_URL=https://clockinpro.autostrata.ai
```

### 3. Push the database schema

```bash
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

---

## Available Scripts

```bash
npm run dev          # Start development server (tsx, hot-reload)
npm run build        # Production build (Vite + esbuild)
npm run start        # Start production server (node dist/index.js)
npm run check        # TypeScript type-checking (tsc)
npm run db:push      # Push Drizzle schema to the database
npm run db:verify    # Verify database schema
```

### Pre-push checklist

Before pushing to `main`, run **both** commands — each must exit with **zero** errors:

```bash
npm run check   # Must report 0 errors
npm run build   # Must succeed
```

`npm run check` runs `tsc --noEmit` and catches type errors that the Vite build ignores. If `check` passes but `build` fails (or vice versa), do not push.

---

## Multi-Tenancy

Every tenant-scoped table has an `organizationId` (or `organisationId` — both spellings exist in the schema; this is a known inconsistency, not a bug to "fix" without a migration plan). All queries are scoped by the authenticated user's organisation.

---

## Authentication & Authorisation

- **Session-based** via `express-session` + `passport-local`.
- Passwords hashed with `bcryptjs`.
- Two roles: `admin` (free seat, runs the organisation) and `employee` (billed seat, clocks in). Helpers in `server/auth.ts`: `requireAuth`, `requireAdmin`.

---

## Free month & billing

- **Card at signup.** `POST /api/signup` creates the organisation with a 30-day free month and returns a Stripe Checkout URL (subscription mode, trial until the free month ends, card required). Nothing is charged until day 31; cancelling before then costs nothing.
- **Entitlement gating** in `server/middleware/entitlement.ts` runs before every API route: an organisation is active during its free month or while its subscription is `active`, `trialing` or `past_due` (Stripe is retrying the card). `canceled`/`unpaid` locks the organisation; admins see plan buttons, employees see "ask your admin".
- **Pricing:** £3.50 per active employee per month, or £3.00 on the annual plan. Admin seats are free. The seat count syncs to Stripe whenever employees change and once a day.
- **Stripe integration** lives in `server/lib/billing.ts` (checkout, portal, status, subscription mirroring) and `server/routes/billing.routes.ts` (webhooks with idempotency via `webhook_events`). Required webhook events are listed in `LAUNCH.md`.
- **Emails** (`server/lib/email.ts`, via Resend): invitation, password reset, free-month-ending reminder, trial-ending with the exact upcoming charge, payment failed.

---

## Scheduling & lateness

- A **weekly contract** is one `shift_templates` row per weekday per employee, with optional effective dates and a site. Admins set it once in the Rota tab; it repeats every week.
- A **shift** row for a specific date overrides the contract for that date (different hours, a one-off shift on a day off, or `cancelled`).
- Shift times are wall-clock times in the organisation's timezone (`organizations.timezone`, default `Europe/London`). Attendance date keys are derived in that timezone, so a 00:30 BST clock-in belongs to the right day.
- **Lateness**: clock-in later than shift start + `organizations.latenessGraceMinutes` → `late +N`. No clock-in after start + grace → `no_show`. Clock-out before end − grace → left early. Worked with no shift → `unscheduled`. Logic is pure and unit-tested in `server/lib/scheduling.ts`.
- Endpoints: `/api/schedules/contracts`, `/api/schedules/shifts`, `/api/rota`, `/api/my-shifts`, `/api/dashboard/today`, and `/api/attendance` (each record annotated with its scheduled shift and verdict).

---

## Organisation branding

Admins set a logo, brand colour, background (six gradients or an uploaded photo), headline and message in the Branding tab. Images are resized in the browser and stored as size-capped data URIs. `GET /api/org/:slug` serves the branding to the public login page; the brand colour overrides the theme's primary and gradient tokens on that page.

---

## Deployment

**Platform:** Railway (Nixpacks)
**Database:** Neon (serverless PostgreSQL)
**Domain:** `clockinpro.autostrata.ai` (custom domain on the Railway service)

Configuration files:
- `nixpacks.toml` — Railway/Nixpacks build config
- `railway.json` — Railway deployment config

No AWS services are used.

---

## Environments

| Environment | Branch | URL | Database | Stripe | Emails |
|---|---|---|---|---|---|
| **Production** | `main` | `clockinpro.autostrata.ai` | Neon `main` branch | Live mode | Real — no prefix |
| **Staging** | `staging` | Railway staging URL | Neon `staging` branch | Test mode | Prefixed `[STAGING]` |
| **Local** | any | `http://localhost:5000` | Local PG or Neon staging | Test mode | Prefixed `[DEVELOPMENT]` |

### Environment variables

- `APP_ENV` — server-side environment label (`development`, `staging`, `production`). Falls back to `NODE_ENV` if unset.
- `VITE_APP_ENV` — client-side environment label. Controls the staging banner visibility.

### Promotion workflow

1. Develop on a feature branch off `staging`.
2. Merge to `staging` → Railway auto-deploys to the staging URL.
3. Test on staging (yellow "STAGING" banner is visible).
4. When verified, merge `staging` → `main` → Railway auto-deploys to production.

See [`STAGING_SETUP.md`](STAGING_SETUP.md) for full staging environment setup instructions.

---

## Project Structure

```
├── client/
│   ├── public/models/           # face-api.js model weights
│   └── src/
│       ├── components/
│       │   ├── brand/           # Logo
│       │   ├── layout/          # MarketingLayout, AuthLayout (org branding), AppShell
│       │   ├── ui/              # shadcn primitives + stat-card, empty-state, confirm-dialog…
│       │   ├── advanced-face-training.tsx   # 3-pose face registration
│       │   └── subscription-gate.tsx        # billing status hooks + lock screen
│       ├── features/admin/      # one file per admin tab: overview, rota, employees, attendance,
│       │                        # locations, assignments, invitations, branding, billing, settings
│       ├── lib/                 # queryClient, face-recognition, dates, image, types
│       └── pages/               # landing, pricing, login, signup, org-login, invite, dashboards, legal
├── server/
│   ├── index.ts                 # sessions → entitlement gate → routes; background jobs
│   ├── auth.ts                  # session middleware, requireAuth / requireAdmin
│   ├── routes.ts                # core API (auth, employees, locations, clock-in, face)
│   ├── routes/                  # billing, schedules, pin/consent, password
│   ├── lib/
│   │   ├── billing.ts           # Stripe helpers + billing status
│   │   ├── scheduling.ts        # rota resolution + lateness (pure)
│   │   ├── time.ts              # timezone helpers (pure)
│   │   ├── face-descriptor.ts   # descriptor validation, centroid, distance, threshold
│   │   └── email.ts             # Resend templates
│   ├── middleware/entitlement.ts
│   ├── jobs/                    # seat sync, trial reminder, auto clock-out
│   └── storage.ts               # Drizzle data access
├── shared/schema.ts             # Drizzle tables + zod validators
└── LAUNCH.md                    # owner-only launch steps
```

---

## What's NOT in the Box

- **No liveness / anti-spoofing** — a printed photo can pass face verification. Geofencing and PIN are the real controls.
- **No SSO** — email and password only.
- **No native mobile app** — responsive web app; works in the phone browser.
- **No offline mode** — every clock-in needs a connection.
- **No multi-language support** — English (UK) only.
- **No payroll export yet** — attendance and lateness are viewable in-app; CSV export is the obvious next step.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make changes and run `npm run check` to verify types
4. Commit and push
5. Open a Pull Request

---

## Support

- **Issues:** GitHub Issues
- **Documentation:** This README

---

Built by [AutoStrata](https://autostrata.ai) · Powered by face-api.js, Express, React, and Stripe.
