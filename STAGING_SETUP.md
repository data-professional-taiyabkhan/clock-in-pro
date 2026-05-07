# Staging Environment Setup

This document describes how to set up and maintain the Clock-in Pro staging
environment on Railway.

---

## Prerequisites

Before proceeding, ensure you have:

1. **Neon staging branch** — created from `main` in console.neon.tech.
2. **Stripe test-mode keys** — `sk_test_...` secret key, plus test-mode
   price IDs for Monthly and Annual plans.
3. **Resend staging API key** — a separate key labelled "staging".
4. **Railway staging service** — `clockinpro-staging` service pointing to
   the `staging` branch of the GitHub repo.

---

## Railway Environment Variables

Paste these into the Railway staging service's **Variables** panel:

```
DATABASE_URL=<Neon staging branch connection string>
SESSION_SECRET=<generate a new random 64-char hex string — must differ from prod>
NODE_ENV=production
APP_ENV=staging
PORT=5000

STRIPE_SECRET_KEY=<sk_test_... key from Stripe test mode>
STRIPE_WEBHOOK_SECRET=<whsec_... — set after creating webhook below>
STRIPE_PRICE_ID_MONTHLY=<test-mode price_... for monthly plan>
STRIPE_PRICE_ID_ANNUAL=<test-mode price_... for annual plan>

RESEND_API_KEY=<re_... staging API key>
RESEND_FROM_EMAIL=Clock-in Pro Staging <noreply@clockinpro.autostrata.ai>

APP_URL=<Railway-assigned staging URL — set after first deploy>
VITE_APP_ENV=staging
```

> **Note:** `NODE_ENV=production` is correct for staging — it ensures the
> production build runs (static files served, no Vite dev server). The
> `APP_ENV=staging` variable is what differentiates staging from production
> in application logic (email prefixes, banner, logging).

---

## Post-Deploy Steps

### 1. Get the staging URL

After the first successful deploy, Railway assigns a URL like
`clockinpro-staging-production.up.railway.app`. Copy this URL.

### 2. Set APP_URL

Update the `APP_URL` variable in Railway to the staging URL
(e.g. `https://clockinpro-staging-production.up.railway.app`).
Trigger a redeploy.

### 3. Create Stripe webhook

1. Go to Stripe Dashboard → **Test Mode** → Developers → Webhooks.
2. Click **Add endpoint**.
3. Enter the URL: `https://<staging-url>/api/billing/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (`whsec_...`).
6. Paste it into `STRIPE_WEBHOOK_SECRET` in Railway variables.
7. Trigger another redeploy.

### 4. Smoke test

1. Visit the staging URL.
2. Confirm the **yellow "STAGING ENVIRONMENT" banner** appears at the top.
3. Sign up with a test email address.
4. Confirm the invitation/welcome email arrives with `[STAGING]` prefix
   in the subject line.
5. Test a Stripe checkout using [Stripe test cards](https://docs.stripe.com/testing):
   - Card number: `4242 4242 4242 4242`
   - Any future expiry, any CVC.
6. After checkout, confirm the subscription activates within seconds.

---

## Custom Domain (Optional)

Add a custom subdomain for easier access:

1. In Railway → Settings → Networking → Custom Domain, add
   `staging.clockinpro.autostrata.ai`.
2. At your DNS provider (e.g. Cloudflare), add a **CNAME** record:
   - Name: `staging.clockinpro`
   - Target: the Railway-assigned hostname
3. Update `APP_URL` in Railway to `https://staging.clockinpro.autostrata.ai`.
4. Trigger a redeploy.

---

## Git Workflow

```
main (production)
 └── staging
      └── feature/xyz (your feature branch)
```

1. Create feature branches off `staging`.
2. Merge to `staging` → Railway auto-deploys to staging.
3. Test on staging.
4. When verified, merge `staging` → `main` → Railway auto-deploys to
   production.

---

## Generating a SESSION_SECRET

Run this in a terminal to generate a random 64-character hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a **different** value for staging than for production.
