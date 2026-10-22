# Vision Tech — Backend

Express 5 + MongoDB (Mongoose) API for the Vision Tech customer portal. It integrates
Tactical RMM (device monitoring), Bitdefender GravityZone (antivirus), PayPal (payments),
Cloudinary (admin file uploads) and SMTP (login codes, alerts, reminders).

## Setup

```bash
cp .env.example .env    # fill in the values
npm install
npm run seed:dev        # plans, system configuration, first admin (SEED_ADMIN_*)
npm run dev             # nodemon on PORT (default 5000)
```

On macOS, port 5000 is often taken by AirPlay Receiver; set `PORT=5001` (and point the
frontend's `VITE_API_BASE_URL` at it) or turn AirPlay Receiver off.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with auto-reload |
| `npm start` | Production server |
| `npm run seed:dev` / `seed:prod` | Create or update plans, system config and the admin user |
| `npm test` | Automated tests (own `*_test` database, fake Tactical/GravityZone; never touches real data) |
| `npm run preflight` | Read-only pre-launch check of settings, data and Tactical access (see `docs/ROLLOUT.md`) |

## Roles and access

Roles: `user` (customer), `admin` (operations), `superadmin` — shown as **Super Admin** (system owner;
only one allowed; formerly `support`, migrated automatically at startup).
Routes use `protect` (valid JWT) and `authorize(...roles)` from `src/middleware/auth.middleware.js`.

| Area | user | admin | superadmin |
|---|---|---|---|
| Own profile, subscription (cancel / reactivate), payments, invoices, tickets, devices | ✓ own only | ✓ | ✓ |
| All users, subscriptions, payments, tickets, antivirus schedules; ticket assignment | | ✓ | ✓ |
| System logs, data management, full-database backups | | ✓ | ✓ |
| Read system configuration | | ✓ | ✓ |
| Change system configuration, send test email | | | ✓ |

## RMM (Tactical RMM)

Each customer's devices live in their own Tactical RMM Site under one Client
(System Configuration → RMM). Staff link an account to its Site in User Management → Edit User
(stored as `rmm.siteId`). Customers only see agents in their linked Site, and Bitdefender
endpoints whose name matches one of those agents' hostnames (`src/utils/deviceOwnership.js`).
Typed serial numbers no longer decide ownership.

| Setting | Meaning |
|---|---|
| System Configuration → RMM → **RMM Client ID** | Client holding one Site per customer |
| System Configuration → RMM → **Site IDs the portal may change** | Safety lock: Sites the app may change (installer links, uninstall, scripts, backups). `*` = all; a test Site id while developing; empty = none |
| `RMM_AUTO_CREATE_SITES` (.env) | `true` creates and links a Site for a customer without one when they add a device |

The two RMM settings are stored in the database (`src/utils/rmmSettings.js`) and take effect
when saved. On the first start after this was added, `RMM_CLIENT_ID` / `RMM_WRITE_ALLOWED_SITE_IDS`
from `.env` are copied in once; after that `.env` is not read for them.

Installer links are generated server-side for the caller's Site and expire after 1 hour.

**Device registry and limits.** `src/cron/rmmDeviceSync.js` mirrors our Client's agents into
`RmmDevice` every 5 minutes (read-only towards Tactical RMM). Plan limits live in
`src/utils/planLimits.js` (Free 1, Pro 5, Enterprise unlimited). Customers at their limit
can't create installers; devices beyond the limit (newest first) are flagged `overLimit` and
staff are emailed once. Nothing is uninstalled automatically.

**Monitoring and alerts.** The sync job runs every 2 minutes; device metrics (fullest disk,
and CPU/memory on Windows) and Tactical check results are refreshed per device every 10
minutes, at most 5 Tactical calls at a time. `GET /api/devices` reads this cache. Alerts
(`RmmAlert`, `src/utils/rmmAlerts.js`) open when a device has been offline for over 30 minutes
or one of its Tactical checks fails (thresholds come from the RMM's check policy), and resolve
on their own when the problem clears. Problems found the first time a device is evaluated are a
silent baseline; each new alert emails the customer and staff once (System Configuration →
Notifications → Device Alerts). `GET /api/devices/alerts`, staff can acknowledge.

**Device details and remote actions.** `GET /api/devices/:id/details` returns hardware, all
disks, Tactical checks, installed software, pending Windows updates, and recent alerts and
actions. `POST /api/devices/:id/actions/:action` (`{ "confirm": true }`) runs one of a fixed set
of actions (`src/utils/rmmActions.js`): `restart` and `disk-cleanup` (Windows; Tactical library
scripts `RMM_SCRIPT_RESTART_ID` / `RMM_SCRIPT_CLEANUP_ID`, restart with a 60-second warning) and
`antivirus-scan` (Bitdefender GravityZone, Windows/macOS). The device must be online; each action
has a per-device cooldown, customers are limited to 10 actions an hour, every request is logged
in `RmmAction`, and the write safety lock applies. There is no free-form command execution.
Staff get a remote-desktop link to `RMM_WEB_URL/takecontrol/<agent>` (Tactical login required).

**Staff console** (frontend `/admin/devices`): every device with its customer, status, disk
and alerts, with filters and totals (`GET /api/devices/console`), the alerts list, and the RMM
activity log (`GET /api/devices/audit`: installer links, Site links, actions, removals, limit
alerts). Moving a device to another customer is done in Tactical RMM (Edit agent → Site), because
this API key can't edit agents; ownership follows on the next sync.

**Customer file backup** (Self-Help → File Backup, `src/utils/fileBackups.js`). Customers on
any plan back up Documents, Desktop and/or Pictures from their own online Windows computer. The
portal runs the Tactical script `scripts/rmm/file-backup.ps1` (`RMM_SCRIPT_FILE_BACKUP_ID`) as
SYSTEM; it zips the signed-in user's folders (skipping locked and OneDrive cloud-only files) and
uploads the zip in parts (`BACKUP_PART_MB`) to `BACKEND_PUBLIC_URL/api/file-backups/agent/*`,
authenticated by a one-time token valid for 6 hours. Parts are private raw files in Cloudinary;
the download joins them back into one zip. Storage per plan is in `src/utils/planLimits.js`
(Free 500 MB); the newest 2 backups of each device are kept. An optional weekly automatic backup
runs from the hourly job (`src/cron/fileBackups.js`), which also fails backups a device never
finished. The write safety lock applies. This is separate from the staff-only database backup.

**Removing a device** (`DELETE /api/devices/:agentId`) uninstalls the agent through Tactical
RMM, for the owner or staff, only on Sites allowed in System Configuration → RMM.

**Plan end** (`src/cron/subscriptionLifecycle.js`, daily 00:30): a paid plan whose period ended
without renewal becomes `expired` with a 7-day `graceUntil`; the customer is emailed and keeps
their plan until then, after which the account moves to Free and device limits are re-checked.
Renewing the same plan early extends it from its current end date.

## Payments

Customers choose **PayPal** or **Card (Stripe)**; both charge one plan period at a time. The
server sets the price from the `Plan` collection and activates a plan only after the payment
is verified: PayPal by capturing the order (`POST /api/payments/paypal/capture-order`), Stripe
by asking Stripe for the Checkout Session when the customer returns
(`POST /api/payments/stripe/confirm`) and through the signed webhook
(`POST /api/payments/stripe/webhook`). A `PaymentClaim` with a unique key per gateway payment
makes fulfilment idempotent when both arrive.

Prices live only in the `Plan` collection; the Billing page reads them from `GET /api/plans`.
Each payment emails the customer a receipt (best effort; needs SMTP).

**Staff (Admin → Payments, `GET /api/payments/admin`)** see every payment from both gateways
with filters and totals, download invoices, and issue **full refunds**
(`POST /api/payments/:id/refund { confirm: true, reason }`, `src/utils/refunds.js`): the refund
is made at Stripe or PayPal, the payment is marked `refunded`, the customer is emailed, and if it
was their latest payment the account moves to Free. Refunds made in the Stripe Dashboard arrive
via the `charge.refunded` webhook; disputes are logged and emailed to staff, and a **lost**
dispute (`charge.dispute.closed`) is treated like a refund.

**PayPal outcomes** (`src/utils/paypalPayments.js`): a completed capture activates the plan; a
**pending** capture is recorded and activated when the PayPal webhook
(`POST /api/payments/paypal/webhook`, verified with PayPal using `PAYPAL_WEBHOOK_ID`) reports
`PAYMENT.CAPTURE.COMPLETED`, or marked failed on `DENIED`; a declined funding source returns
`INSTRUMENT_DECLINED` so the PayPal button lets the buyer choose another. Refunds and reversals
made in PayPal are recorded like Stripe's.
`src/utils/planActivation.js` keeps the subscription and the user's `plan` field (which
drives device limits) in sync. `PAYPAL_MODE=live` switches from Sandbox to live payments.

## Secrets in the database

The SMTP password is never returned by the API (`smtpPasswordSet` tells the UI whether one
is saved) and is encrypted with AES-256-GCM when `CONFIG_ENCRYPTION_KEY` is set.

## Scheduled jobs

Run inside the web process (`src/cron`): subscription renewal reminders (daily 09:00),
plan-end grace handling (daily 00:30), RMM device sync and alerts (every 2 minutes),
antivirus scan scheduler (every minute) and the database backup (daily 10:55, written to
`vision-tech-backup/` on local disk). On hosts with ephemeral disks or sleeping free
instances (e.g. Render free tier), backups are lost and jobs pause.
