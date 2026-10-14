# Sleek Trading v2

The rebuilt Sleek Trading app. It runs alongside the legacy app in the repo root and replaces it module by module.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Query / Table v9 · Zustand · React Hook Form + Zod · nuqs · Drizzle ORM · PostgreSQL · Vitest

## Getting started

```bash
npm install
npm run db:reset     # create the local database, run migrations, load sample data
npm run dev          # starts PostgreSQL + Next.js on http://localhost:3000
```

Local development runs a **real PostgreSQL 18** from the `embedded-postgres` npm package, so there's nothing to install
(no Docker or Homebrew). Data lives in `.data/postgres`, and uploaded documents and receipts in `.data/uploads`. `npm run dev`
starts the database and stops it again when you quit.

To use a hosted Postgres instead (Neon, Supabase, RDS…), copy `.env.example` to `.env.local` and set `DATABASE_URL`.
Every script and the app then use that database, and nothing local is started.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Start local Postgres (if needed) and the Next.js dev server |
| `db:start` | Run local Postgres on its own, e.g. alongside Drizzle Studio |
| `db:generate` | Create a SQL migration from changes to `src/db/schema.ts` |
| `db:migrate` | Apply pending migrations |
| `db:seed` | Load sample data into an empty database |
| `db:reset` | Wipe the **local** database and uploads, migrate and seed (refuses to run against `DATABASE_URL`) |
| `db:studio` | Browse data in Drizzle Studio (needs the database running) |
| `test` | Unit tests (the installment ledger) |
| `typecheck` | Run the TypeScript compiler |

## Project layout

```
src/
  app/              routes: (app) pages + api/ route handlers
  components/
    ui/             shadcn/ui primitives (owned code; edit freely)
    data-table/     server-driven table: URL state, sorting, pagination, empty states
    form/           form dialog shell and field helpers
    shell/          sidebar, header, ⌘K command palette
  config/           navigation (drives sidebar, breadcrumbs and ⌘K)
  db/               Drizzle schema, client, migrate and seed scripts
  features/<module> schema (Zod, shared by form + API), server queries, query hooks, views
  server/           shared server helpers (HTTP errors, list params, search)
  stores/           Zustand stores (app-wide dialogs, command palette)
drizzle/            generated SQL migrations
```

## Modules

Customers, Vehicles, Agreements (cash sale, hire purchase, buying), Proforma & final invoices, Installments, Payments and
Bank accounts. Agreement and invoice PDFs use the legacy generators unchanged (`src/features/documents/legacy`), fed through
`adapters.ts`. The hire purchase account statement is new.

## Accounts and access

There are two separate dashboards, and everyone signs in at `/login`:

| Role | Lands on | Can do |
|---|---|---|
| **Super admin** | `/admin` (AutoVault) | Creates dealerships and their admins, sees every dealership's data, manages plans and platform billing. |
| **Dealership admin** | `/` | Runs one dealership: customers, vehicles, agreements, invoices, payments, billing and Settings. Sees only that dealership. |

- Sessions are server-side; the cookie holds a random token and only its hash is stored. Passwords use scrypt.
- Every page and API route checks the role on the server (`src/server/auth.ts`). `proxy.ts` only turns away requests with no session at all.
- A dealership admin's dealership comes from their account and can't be switched. Suspending a dealership signs its admins out immediately.
- **Demo accounts** (local only): `npm run db:seed` creates `super@autovault.test` and one admin per demo dealership (see `src/db/seed-users.ts`, which also holds the shared password).
- **First super admin on a real database:** `npm run user:create-super-admin -- you@example.com "Your Name"`. The password comes from `SUPER_ADMIN_PASSWORD` or is generated and printed once.
- The super admin creates a dealership together with its first admin. A temporary password is generated and shown once, and the admin is asked to choose their own at first sign-in. Passwords can be reset from the dealership's **Admins** tab.
- Login attempts are throttled in memory (8 failures per email and IP in 10 minutes). That doesn't survive a restart or span several servers, so move it to the database or Redis before running more than one instance.

## Dealerships (multi-tenant)

Every customer, vehicle, bank account, agreement and invoice belongs to a dealership. Composite foreign keys `(dealership_id, id)` stop the database from linking records across dealerships. Server list functions take a `scope`: the signed-in admin's dealership id, or `null` for the super admin.

A dealership has a name, country, city, phone, email and a status (**Active** or **Suspended**). Its short **code** (the agreement-number prefix, e.g. `NRB-1012`) is generated from the name when it is created and never changes, so existing agreement numbers stay valid.

### Branding

Each dealership can customise its own dashboard under **Settings**: a logo (PNG, JPG or WebP, up to 1 MB), a dashboard title, a sidebar colour and a button/highlight colour. The colours are applied as CSS variables on `<html>` (`src/features/branding/theme.ts`). The super admin can edit any dealership's branding from its detail page.

### Custom plans

Growth is the only public plan for now. A super admin can create a **custom plan** for one dealership (from its detail page, or on the Plans page); only that dealership can see and choose it. A dealership can never pick another dealership's plan.

## Super admin (`/admin`, AutoVault)

- Overview: KPIs, collections by dealership, deal mix, and a leaderboard.
- **Dealerships**: sortable table (name, country, phone, city, opened), filters, and create/edit/suspend/delete.
- **Dealership detail** (`/admin/dealerships/[id]`): overview, admins, branding, plan and billing (including custom plans), and links into that dealership's data.
- Read-only tables of every customer, vehicle, agreement, installment, payment and invoice across all dealerships, with a dealership filter.
- Billing: revenue, subscriptions, invoices, transactions, plans and the event log (see below).

## Platform billing (Stripe)

Dealerships pay the platform a subscription. The code lives in `src/features/billing`.

- **Dealership admins** manage their own plan at `/billing`: current plan, card on file, switching or cancelling, and invoices with "Pay now". A banner across the dealership dashboard appears when a payment has failed or there's no plan.
- **The super admin** gets a Billing section with these pages:
  - Revenue: MRR/ARR, net collections, failed payments and provider events.
  - Subscriptions: change plan, cancel at period end or now, resume.
  - Billing invoices: charge the card on file, void.
  - Transactions: every charge, decline and refund, with refunds.
  - Plans: create/edit, with price changes synced to Stripe.
  - Event log.

**How it works.** Stripe is the source of truth. We create customers and Checkout/Portal sessions, and mirror Stripe's subscriptions, invoices and charges into `subscriptions`, `billing_invoices` and `billing_transactions` from webhooks (`/api/webhooks/stripe`).

- Each webhook re-fetches the latest object from Stripe, so ordering and retries don't matter.
- `billing_events` makes delivery idempotent and doubles as the audit log.
- Amounts are stored in minor units, exactly as Stripe reports them.

**Sandbox.** With no `STRIPE_SECRET_KEY`, a built-in sandbox provider simulates everything:

- a checkout page with approving and declining test cards;
- renewals, via "Simulate next billing cycle" on the Revenue page;
- declines, retries, past-due/unpaid, refunds and webhook-style events.

Each record remembers which provider created it, so sandbox data keeps working after you add keys.

**Going live with Stripe:**

1. Set `STRIPE_SECRET_KEY` (start with `sk_test_…`) in `.env.local`.
2. Add a webhook endpoint in the Stripe dashboard pointing at `https://<your-domain>/api/webhooks/stripe`, and put its secret in `STRIPE_WEBHOOK_SECRET`. Locally, use `stripe listen --forward-to localhost:3100/api/webhooks/stripe`.
3. Subscribe it to these events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`, `invoice_payment.paid`, `charge.*` and `customer.updated`.
4. Enable the Customer Portal in Stripe (Settings → Billing → Customer portal) so dealerships can update their card.

Plans become Stripe Products/Prices on their first checkout.

## Payments ledger

Recording a payment against an installment (`src/features/installments/ledger.ts`):

- Up to the installment's balance pays that installment.
- Any excess pays the following installments in order.
- A shortfall moves to the next installment (or stays owing, if the clerk turns that off).

Each payment stores exactly what it changed in `payment_allocations`, so reversing it undoes those changes precisely.
Only the most recent payment on an agreement can be reversed. Payments lock the schedule rows, so simultaneous payments
are applied one after another. Once payments exist, an agreement's price and terms can't be edited.

## Adding a module

Customers and Vehicles are the simplest reference implementations. For a new module:

1. Add the table in `src/db/schema.ts`, then run `npm run db:generate` and `npm run db:migrate`.
2. Create `src/features/<module>/`: `schema.ts` (Zod), `server.ts` (queries), `queries.ts` (`createResource`), a form dialog and a view.
3. Add route handlers under `src/app/api/<module>/`, and a page under `src/app/(app)/<module>/`.
4. Remove `soon: true` from its entry in `src/config/navigation.ts`.

## Conventions

- **Money** is `numeric(14,2)`. Sums are done in SQL, never by adding JavaScript floats.
- **Installment status** (upcoming, partly paid, paid, carried forward, overdue) is derived when read, not stored.
  "Today" is always the Nairobi business day.
- **Uniqueness** is enforced by Postgres constraints. The API maps violations to field-level form errors.
- **`legacy_id`** holds the original MongoDB `_id`, so the data migration can be re-run safely.
