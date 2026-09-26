# Clock-In Pro

Face-verified, geofenced attendance for UK SMBs with hourly staff. Stops buddy-punching. Ships in 2 weeks.

Clock-In Pro lets employees clock in and out by looking at their webcam. The system matches their face against a registered embedding, verifies their GPS location is within an allowed geofence, and records the attendance event. Managers get real-time dashboards, attendance reports, and employee management — all behind a multi-tenant SaaS with Stripe billing and a 14-day free trial.

**Live at:** [clockinpro.autostrata.ai](https://clockinpro.autostrata.ai)

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
- Role helpers exported from `server/auth.ts`: `requireAuth`, `requireManager`, `requireAdmin`.

---

## Trial & Billing

- **14-day free trial** starts on organisation creation (`organizations.trialEndsAt`).
- **Entitlement gating** via `server/middleware/entitlement.ts` — blocks API routes unless the trial is active OR a paying Stripe subscription exists.
- **Pricing:**
  - **Monthly:** £3.50 per employee per month
  - **Annual:** £3.00 per employee per month (billed annually)
  - Admin and manager seats are **free** — only employee seats are billable.
- **Stripe integration:** Checkout, Customer Portal, and Webhooks (with idempotency via `webhook_events` table) in `server/routes/billing.routes.ts`.

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
├── client/                  # React frontend (Vite)
│   ├── public/models/       # face-api.js model weights
│   └── src/
│       ├── components/      # UI components (shadcn/ui)
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Client utilities
│       └── pages/           # Route pages
├── server/
│   ├── auth.ts              # Passport session auth
│   ├── routes.ts            # Main API routes
│   ├── storage.ts           # Database access layer
│   ├── lib/
│   │   └── face-descriptor.ts # Descriptor validation, centroid, distance, threshold
│   ├── middleware/
│   │   └── entitlement.ts   # Trial / subscription gating
│   └── routes/
│       └── billing.routes.ts # Stripe billing routes
├── shared/                  # Shared types & schema (Drizzle)
└── scripts/                 # DB verification & utilities
```

---

## What's NOT in the Box

Being upfront about current limitations:

- **No SSO** — authentication is username/password only. No SAML, OIDC, or social login.
- **No native mobile app** — the system is a responsive web app. No iOS/Android app in the stores.
- **No on-premises deployment** — designed for Railway + Neon. Self-hosting is possible but unsupported.
- **No offline mode** — requires an internet connection for every clock-in.
- **No multi-language support** — English (UK) only.
- **No audit log export** — attendance data is viewable in-app but there's no CSV/PDF export yet.

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
