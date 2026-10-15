# Go-live checklist (security fixes + RMM)

Work through these in order. Steps marked **(blocking)** must be done before customers use the new version.

## 1. Before deploying

1. **Back up the production database** (Atlas snapshot or `mongodump`). This is the rollback point.
2. **Tactical RMM API key permissions** (Tactical → Settings → Users/Roles for the key's user):
   *Run scripts* (needed), *Uninstall agents* (needed for "Remove device"), optionally *Edit agents* and *Use MeshCentral*.
3. **Production environment variables** (Render → Environment). See `Backend/.env.example` for all of them.
   - (blocking) `JWT_SECRET` — new random string, 32+ characters. Changing it logs everyone out once.
   - (blocking) `CONFIG_ENCRYPTION_KEY` — random string; never change it afterwards.
   - (blocking) `FRONTEND_URL`, `MONGO_URI`
   - `RMM_CLIENT_ID=12`, `RMM_WRITE_ALLOWED_SITE_IDS=*`, `RMM_AUTO_CREATE_SITES=true|false`
   - `RMM_SCRIPT_RESTART_ID=81`, `RMM_SCRIPT_CLEANUP_ID=11`, `RMM_WEB_URL=https://rmm.remote.newvtech.com`
   - `PAYPAL_MODE=live` with live PayPal keys, when taking real payments
   - `STRIPE_SECRET_KEY` (`sk_live_…` for real payments) and `STRIPE_WEBHOOK_SECRET` (next step)
4. **Stripe webhook**: Stripe Dashboard (live mode) → Developers → Webhooks → *Add endpoint*
   `https://<your-api-domain>/api/payments/stripe/webhook`, events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded` and `charge.dispute.created`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   **PayPal webhook**: developer.paypal.com → your app → Webhooks → *Add webhook*
   `https://<your-api-domain>/api/payments/paypal/webhook`, events `PAYMENT.CAPTURE.COMPLETED`,
   `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`,
   `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`.
   Put its **Webhook ID** into `PAYPAL_WEBHOOK_ID`. (PayPal must reach a public URL, so this can't be
   tested on localhost.)
   Optional: Settings → Adaptive Pricing decides whether customers may pay in their local currency
   (Stripe adds a conversion fee); the server always checks the USD amount.
   - Must **not** be set in production: `RATE_LIMIT_DISABLED`, `DISABLE_CRON`, `DEBUG_GRAVITYZONE`
   - Frontend: `VITE_API_BASE_URL`. `VITE_CLIENT_ID` / `VITE_SITE_ID` are no longer used.
5. **Run the pre-launch check against production** from a machine with the production `.env`:
   `cd Backend && npm run preflight` — fix every **BLOCKING** line and read every **CHECK** line.
   In particular it lists paid subscriptions already past their renewal date: the first nightly run (00:30)
   starts their 7-day grace period and emails them.

## 2. Deploy

1. `cd Backend && npm test` must pass (it uses its own `*_test` database and fake RMM; safe to run anywhere).
2. Deploy backend, then frontend (rebuild the frontend so new `VITE_*` values apply).
3. Check the backend log shows `MongoDB connected` and no `RMM_DEVICE_SYNC_ERROR` within 5 minutes.

## 3. Right after deploying

1. Log in as the **Super Admin** → System Configuration → Email: enter SMTP details → **Send test email** → Save.
   Turn **Device Alerts** on or off as wanted.
2. Make sure the Admin and Super Admin accounts have **real email addresses** (alerts go there).
3. **Link existing customers to their RMM Sites**: User Management → Edit user → Role/Status step →
   *Device group (RMM Site)* → Link. Current Sites: Adriana Horowitz, Corey Scarbrough, Diana Corwin,
   Howard Horowitz, Lolita, Stacy Lavacca, Tim Jacobs.
4. Open **Devices** (Admin) — all devices should appear with their customer; "Unlinked sites" should be 0
   (the test Site may remain).
5. Smoke test with a real customer account: log in, see own devices only, open Details, request a login code.

## 4. Real-device test (test Site #73)

With a spare Windows computer: link a test account to Site 73, add the device from the RMM page, then try
Restart, Clean up disk, Antivirus scan and Remove device. Check each in the Activity log.

## Rollback

1. Redeploy the previous backend and frontend versions.
2. The new code only **adds** fields and collections (`rmmdevices`, `rmmalerts`, `rmmactions`, `user.rmm`,
   `subscription.graceUntil`, `payment.transactionId`); the old version ignores them, so no data restore is
   needed unless data was damaged. If it was, restore the backup from step 1.1.
3. Note: subscriptions moved to `expired` by the new nightly job stay expired after a rollback; reactivate
   them from Subscriptions (Admin) if needed.
