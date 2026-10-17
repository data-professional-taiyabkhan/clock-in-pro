# Launch checklist

Everything below is what only you (the owner) can do. The code side is ready: the
app builds, type-checks, and every flow was exercised end to end in a headless
browser against a mock API. Work through this top to bottom on **staging first**,
then repeat with live values for **production**.

## 1. Database

The schema changed in this release (branding columns, scheduling tables, timezone,
lateness grace). Push it before deploying the new build:

```bash
DATABASE_URL=<neon connection string> npm run db:push
```

On first boot the server converts any remaining `manager` accounts to `employee`
(the manager role no longer exists) and logs how many it changed.

Check for employees whose stored face data predates the fixed face pipeline. They
get a clear "please re-register" message on their next clock-in, but you can list
them in advance:

```sql
SELECT id, email FROM users
WHERE face_embedding IS NOT NULL
  AND (jsonb_typeof(face_embedding::jsonb) <> 'array' OR jsonb_array_length(face_embedding::jsonb) <> 128);
```

## 2. Stripe

1. Create two recurring prices on one product in **live mode**: £3.50 / seat /
   month and £3.00 / seat / month billed yearly (£36 / seat / year). Copy their
   `price_...` IDs into `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL`.
2. Set `STRIPE_SECRET_KEY` to the live secret key.
3. Add a webhook endpoint pointing at `https://<your domain>/api/billing/webhook`
   with these events, then copy the signing secret into `STRIPE_WEBHOOK_SECRET`:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.paused`,
     `customer.subscription.resumed`
   - `customer.subscription.trial_will_end` (emails the admin 3 days before the first charge)
   - `invoice.paid`, `invoice.payment_failed`
4. In **Settings → Billing → Customer portal**, enable: update payment method,
   view invoices, cancel subscription, and switching between the two prices.
5. Turn on **Smart Retries** under Billing settings so a failed card is retried
   before the subscription becomes unpaid. The app keeps staff clocking in while
   a payment is `past_due` and only locks the organisation out when Stripe gives up.
6. Test with a Stripe test card on staging: sign up, confirm you land in Checkout
   with "30 days free", complete it, confirm the dashboard banner disappears and
   the Billing tab shows "Free month until <date>".

## 3. Email (Resend)

1. Verify your sending domain in Resend and set `RESEND_FROM_EMAIL` to an address
   on it, e.g. `Clock-In Pro <hello@clockinpro.autostrata.ai>`.
2. Set `RESEND_API_KEY`.
3. Set `APP_URL` to the public URL (used in every email link and in Stripe redirects).

## 4. Environment variables (Railway)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `SESSION_SECRET` | 64+ random characters, different per environment |
| `NODE_ENV` | `production` |
| `APP_ENV` / `VITE_APP_ENV` | `production` (or `staging` to show the banner) |
| `APP_URL` | `https://clockinpro.autostrata.ai` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL` | from step 2 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | from step 3 |
| `FACE_MATCH_THRESHOLD` | optional, default `0.6`; lower is stricter |

## 5. Domain

Point `clockinpro.autostrata.ai` at the Railway service and confirm HTTPS. Employee
login links are `https://clockinpro.autostrata.ai/org/<slug>`; they are shown to
admins in Settings and in the Branding tab.

## 6. Smoke test on production (10 minutes)

1. **Sign up** a real organisation → Checkout → back to the dashboard. Banner gone,
   Billing tab shows the free month end date.
2. **Branding**: upload a logo, pick a colour and background, open the org link in a
   private window. Confirm the login page is branded.
3. **Employees**: add one employee (note the one-time password) and invite another
   by email. Open the invite link, set a password, confirm you land on the employee
   dashboard inside the right organisation.
4. **Face**: as the employee, Settings → grant consent → register face (three
   poses). Then clock in with face on a phone. Clock out.
5. **PIN**: set a PIN, clock in with PIN.
6. **Rota**: set a weekly contract (e.g. 08:00–12:00 Mon–Thu & Sat), set the grace
   period to 5 minutes, clock in 7 minutes late → Overview shows "Late +7m".
7. **Lifecycle**: deactivate the employee → Billing tab seat count drops; reactivate.
8. **Stripe**: in the Stripe dashboard confirm the subscription quantity matches the
   active employee count.

## 7. Things to know

- Liveness detection is a stub: a printed photo held to a phone will pass face
  verification. Geofencing and PIN remain the real controls. Say so in sales
  conversations rather than promising anti-spoofing.
- Images (logos, wallpapers) are stored as data URIs in Postgres with size caps.
  Fine for SMB volumes; move to object storage if a customer uploads hundreds.
- Dead code that could not be removed from this branch by the automation and is
  safe to delete by hand: `client/src/pages/welcome-page.tsx`,
  `client/src/pages/auth-page.tsx`, `client/src/pages/security-test.tsx`,
  `client/src/components/face-auth-modal.tsx`,
  `client/src/components/camera-face-capture.tsx`,
  `client/src/components/simple-face-capture.tsx`, `server/lib/faceCompare.ts`.
