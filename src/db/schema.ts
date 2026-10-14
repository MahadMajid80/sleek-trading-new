import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2, mode: "number" })

const id = () => uuid("id").primaryKey().defaultRandom()

// Mongo ObjectId of the source document, kept so the data migration is idempotent and traceable.
const legacyId = () => varchar("legacy_id", { length: 24 }).unique()

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const dealershipStatus = pgEnum("dealership_status", ["active", "suspended"])

// Tenants. Every customer, car, bank account, agreement and invoice belongs to exactly one dealership, and composite
// foreign keys (dealership_id, id) make it impossible for a record to reference another dealership's data.
export const dealerships = pgTable(
  "dealerships",
  {
    id: id(),
    /** 2–5 uppercase letters; prefixes agreement numbers, e.g. SLK-1004. */
    code: varchar("code", { length: 5 }).notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull().default("KE"),
    phone: varchar("phone", { length: 15 }),
    email: text("email"),
    status: dealershipStatus("status").notNull().default("active"),
    // Dashboard branding the dealership's own admin controls (see /settings). All optional; defaults apply when null.
    brandTitle: text("brand_title"),
    logoKey: text("logo_key"),
    logoMimeType: varchar("logo_mime_type", { length: 40 }),
    /** Wide wordmark-style logos fill the sidebar width; square ones sit beside the title. Set by the uploader. */
    logoWide: boolean("logo_wide").notNull().default(false),
    sidebarColor: varchar("sidebar_color", { length: 7 }),
    accentColor: varchar("accent_color", { length: 7 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("dealerships_code_key").on(t.code),
    check("dealerships_sidebar_color_hex", sql`${t.sidebarColor} is null or ${t.sidebarColor} ~ '^#[0-9a-fA-F]{6}$'`),
    check("dealerships_accent_color_hex", sql`${t.accentColor} is null or ${t.accentColor} ~ '^#[0-9a-fA-F]{6}$'`),
    check("dealerships_code_format", sql`${t.code} ~ '^[A-Z]{2,5}$'`),
  ],
)

const dealershipId = () =>
  uuid("dealership_id")
    .notNull()
    .references(() => dealerships.id, { onDelete: "restrict" })

export const userRole = pgEnum("user_role", ["super_admin", "dealer_admin"])
export const userStatus = pgEnum("user_status", ["active", "disabled"])

// People who can sign in. A super admin runs the platform (no dealership); a dealer admin manages exactly one dealership
// and only ever sees its data.
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    dealershipId: uuid("dealership_id").references(() => dealerships.id, { onDelete: "restrict" }),
    status: userStatus("status").notNull().default("active"),
    /** Set when an admin issued a temporary password; cleared when the user chooses their own. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
    index("users_dealership_idx").on(t.dealershipId),
    check(
      "users_role_dealership",
      sql`(${t.role} = 'super_admin' and ${t.dealershipId} is null) or (${t.role} = 'dealer_admin' and ${t.dealershipId} is not null)`,
    ),
  ],
)

/** Server-side sessions. Only the SHA-256 of the cookie token is stored, so a database leak can't be replayed. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
)

export const customers = pgTable(
  "customers",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    name: text("name").notNull(),
    nationalId: varchar("national_id", { length: 8 }).notNull(),
    telephone: varchar("telephone", { length: 15 }).notNull(),
    email: text("email"),
    kraPin: varchar("kra_pin", { length: 11 }).notNull(),
    poBox: varchar("po_box", { length: 15 }),
    ...timestamps(),
  },
  (t) => [
    unique("customers_dealership_id_id_key").on(t.dealershipId, t.id),
    uniqueIndex("customers_national_id_key").on(t.dealershipId, t.nationalId),
    uniqueIndex("customers_telephone_key").on(t.dealershipId, t.telephone),
    uniqueIndex("customers_email_key").on(t.dealershipId, sql`lower(${t.email})`),
    index("customers_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
    index("customers_created_at_idx").on(t.createdAt),
  ],
)

export const cars = pgTable(
  "cars",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    bodyType: text("body_type").notNull(),
    year: integer("year").notNull(),
    chassisNo: varchar("chassis_no", { length: 30 }),
    engineNo: varchar("engine_no", { length: 30 }),
    regNo: varchar("reg_no", { length: 8 }),
    color: text("color").notNull(),
    cc: integer("cc").notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("cars_dealership_id_id_key").on(t.dealershipId, t.id),
    uniqueIndex("cars_chassis_no_key").on(t.dealershipId, t.chassisNo),
    uniqueIndex("cars_reg_no_key").on(t.dealershipId, t.regNo),
    index("cars_brand_name_trgm_idx").using(
      "gin",
      sql`(${t.brand} || ' ' || ${t.name}) gin_trgm_ops`,
    ),
    index("cars_created_at_idx").on(t.createdAt),
    check("cars_identifier_present", sql`${t.chassisNo} is not null or ${t.regNo} is not null`),
  ],
)

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    title: text("title").notNull(),
    bankName: text("bank_name").notNull(),
    branchName: text("branch_name"),
    accountNumber: varchar("account_number", { length: 40 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("bank_accounts_dealership_id_id_key").on(t.dealershipId, t.id),
    uniqueIndex("bank_accounts_bank_account_number_key").on(t.dealershipId, sql`lower(${t.bankName})`, t.accountNumber),
  ],
)

export const agreementType = pgEnum("agreement_type", ["cash_sale", "hire_purchase", "buying"])
export const installmentFrequency = pgEnum("installment_frequency", ["monthly", "yearly"])
export const tradeInKind = pgEnum("trade_in_kind", ["cash", "buying", "hire_purchase"])

export const agreements = pgTable(
  "agreements",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    // Displayed as {dealership code}-{number}, e.g. SLK-1004; by-default identity so migrated agreements keep their numbers.
    number: integer("number").generatedByDefaultAsIdentity().notNull().unique(),
    type: agreementType("type").notNull(),
    // Parties, car and account are checked against the same dealership by the composite foreign keys below.
    // Buyer is optional on buying agreements, where the dealership itself is the buyer.
    customerId: uuid("customer_id"),
    carId: uuid("car_id").notNull(),
    bankAccountId: uuid("bank_account_id"),
    sellerId: uuid("seller_id"),
    witnessId: uuid("witness_id"),
    nextOfKinId: uuid("next_of_kin_id"),
    agreedPrice: money("agreed_price").notNull(),
    deposit: money("deposit").notNull().default(0),
    balance: money("balance").notNull().default(0),
    remainingDepositPaymentMethod: text("remaining_deposit_payment_method"),
    physicalLogbook: boolean("physical_logbook").notNull().default(false),
    transferLogbook: boolean("transfer_logbook").notNull().default(false),
    uponPayment: boolean("upon_payment").notNull().default(false),
    paybill: text("paybill"),
    installmentFrequency: installmentFrequency("installment_frequency"),
    installmentDuration: integer("installment_duration"),
    startingDate: date("starting_date"),
    hasTracker: boolean("has_tracker").notNull().default(false),
    trackerFee: money("tracker_fee"),
    trackerDuration: text("tracker_duration"),
    includeAdditionalNotes: boolean("include_additional_notes").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    unique("agreements_dealership_id_id_key").on(t.dealershipId, t.id),
    ...(["customerId", "sellerId", "witnessId", "nextOfKinId"] as const).map((column) =>
      foreignKey({
        name: `agreements_${column}_same_dealership_fk`,
        columns: [t.dealershipId, t[column]],
        foreignColumns: [customers.dealershipId, customers.id],
      }).onDelete("restrict"),
    ),
    foreignKey({
      name: "agreements_car_same_dealership_fk",
      columns: [t.dealershipId, t.carId],
      foreignColumns: [cars.dealershipId, cars.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "agreements_bank_account_same_dealership_fk",
      columns: [t.dealershipId, t.bankAccountId],
      foreignColumns: [bankAccounts.dealershipId, bankAccounts.id],
    }).onDelete("restrict"),
    index("agreements_dealership_idx").on(t.dealershipId),
    index("agreements_customer_idx").on(t.customerId),
    index("agreements_car_idx").on(t.carId),
    index("agreements_created_at_idx").on(t.createdAt),
    check("agreements_amounts_non_negative", sql`${t.agreedPrice} >= 0 and ${t.deposit} >= 0 and ${t.balance} >= 0`),
    check(
      "agreements_required_party",
      sql`(${t.type} = 'buying' and ${t.sellerId} is not null) or (${t.type} <> 'buying' and ${t.customerId} is not null)`,
    ),
    check(
      "agreements_hp_terms",
      sql`${t.type} <> 'hire_purchase' or (${t.installmentFrequency} is not null and ${t.installmentDuration} > 0 and ${t.startingDate} is not null)`,
    ),
  ],
)

export const agreementTradeIns = pgTable(
  "agreement_trade_ins",
  {
    id: id(),
    dealershipId: dealershipId(),
    agreementId: uuid("agreement_id").notNull(),
    carId: uuid("car_id").notNull(),
    kind: tradeInKind("kind").notNull(),
    amount: money("amount").notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: "agreement_trade_ins_agreement_same_dealership_fk",
      columns: [t.dealershipId, t.agreementId],
      foreignColumns: [agreements.dealershipId, agreements.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "agreement_trade_ins_car_same_dealership_fk",
      columns: [t.dealershipId, t.carId],
      foreignColumns: [cars.dealershipId, cars.id],
    }).onDelete("restrict"),
    index("agreement_trade_ins_agreement_idx").on(t.agreementId),
  ],
)

export const agreementDocuments = pgTable(
  "agreement_documents",
  {
    id: id(),
    legacyId: legacyId(),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agreement_documents_agreement_idx").on(t.agreementId)],
)

// Status (pending / partial / paid / overdue / carried) is derived from these amounts and the due date at read
// time, so it can never drift out of sync the way a stored status field can. All three money columns are only
// ever changed through payment_allocations, which makes every change traceable and reversible.
export const installments = pgTable(
  "installments",
  {
    id: id(),
    legacyId: legacyId(),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    dueDate: date("due_date").notNull(),
    amount: money("amount").notNull(),
    paid: money("paid").notNull().default(0),
    /** Shortfall moved onto this installment from an earlier one. */
    carriedOver: money("carried_over").notNull().default(0),
    /** Shortfall moved off this installment onto a later one; no longer owed here. */
    carriedForward: money("carried_forward").notNull().default(0),
    lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("installments_agreement_sequence_key").on(t.agreementId, t.sequence),
    index("installments_due_date_idx").on(t.dueDate),
    check(
      "installments_amounts_non_negative",
      sql`${t.amount} >= 0 and ${t.paid} >= 0 and ${t.carriedOver} >= 0 and ${t.carriedForward} >= 0`,
    ),
  ],
)

export const payments = pgTable(
  "payments",
  {
    id: id(),
    legacyId: legacyId(),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id, { onDelete: "restrict" }),
    /** The installment the customer was paying when this was recorded. */
    installmentId: uuid("installment_id").notNull().references(() => installments.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    paidOn: date("paid_on").notNull(),
    notes: text("notes"),
    receiptKey: text("receipt_key").notNull(),
    receiptName: text("receipt_name").notNull(),
    receiptMimeType: text("receipt_mime_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (t) => [
    index("payments_agreement_idx").on(t.agreementId),
    index("payments_installment_idx").on(t.installmentId),
    index("payments_paid_on_idx").on(t.paidOn),
    check("payments_amount_positive", sql`${t.amount} > 0`),
  ],
)

export const allocationKind = pgEnum("allocation_kind", ["paid", "carry_out", "carry_in"])

// How a payment changed installments: `paid` adds to installments.paid (overpayments pay following installments),
// `carry_out`/`carry_in` move an unpaid shortfall to the next installment. Reversing a payment subtracts these.
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").notNull().references(() => installments.id, { onDelete: "restrict" }),
    kind: allocationKind("kind").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [
    index("payment_allocations_payment_idx").on(t.paymentId),
    index("payment_allocations_installment_idx").on(t.installmentId),
    check("payment_allocations_amount_positive", sql`${t.amount} > 0`),
  ],
)

export const proformaStatus = pgEnum("proforma_status", ["draft", "live"])

type InvoiceColumns = {
  dealershipId: AnyPgColumn
  customerId: AnyPgColumn
  carId: AnyPgColumn
  bankAccountId: AnyPgColumn
}

const invoiceReferences = (table: string, t: InvoiceColumns) => [
  foreignKey({
    name: `${table}_customer_same_dealership_fk`,
    columns: [t.dealershipId, t.customerId],
    foreignColumns: [customers.dealershipId, customers.id],
  }).onDelete("restrict"),
  foreignKey({
    name: `${table}_car_same_dealership_fk`,
    columns: [t.dealershipId, t.carId],
    foreignColumns: [cars.dealershipId, cars.id],
  }).onDelete("restrict"),
  foreignKey({
    name: `${table}_bank_account_same_dealership_fk`,
    columns: [t.dealershipId, t.bankAccountId],
    foreignColumns: [bankAccounts.dealershipId, bankAccounts.id],
  }).onDelete("restrict"),
  index(`${table}_dealership_idx`).on(t.dealershipId),
]

export const proformaInvoices = pgTable(
  "proforma_invoices",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    number: integer("number").generatedByDefaultAsIdentity().notNull().unique(),
    customerId: uuid("customer_id").notNull(),
    carId: uuid("car_id").notNull(),
    bankAccountId: uuid("bank_account_id"),
    agreedPrice: money("agreed_price").notNull(),
    deposit: money("deposit").notNull().default(0),
    balance: money("balance").notNull().default(0),
    status: proformaStatus("status").notNull().default("draft"),
    ...timestamps(),
  },
  (t) => [
    unique("proforma_invoices_dealership_id_id_key").on(t.dealershipId, t.id),
    ...invoiceReferences("proforma_invoices", t),
    index("proforma_invoices_customer_idx").on(t.customerId),
  ],
)

export const finalInvoices = pgTable(
  "final_invoices",
  {
    id: id(),
    legacyId: legacyId(),
    dealershipId: dealershipId(),
    number: integer("number").generatedByDefaultAsIdentity().notNull().unique(),
    // Plain FK (not composite) so deleting the proforma can null it; publishing always copies the same dealership.
    proformaInvoiceId: uuid("proforma_invoice_id")
      .unique()
      .references(() => proformaInvoices.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").notNull(),
    carId: uuid("car_id").notNull(),
    bankAccountId: uuid("bank_account_id"),
    agreedPrice: money("agreed_price").notNull(),
    deposit: money("deposit").notNull().default(0),
    balance: money("balance").notNull().default(0),
    ...timestamps(),
  },
  (t) => [...invoiceReferences("final_invoices", t), index("final_invoices_customer_idx").on(t.customerId)],
)

// ─── Platform billing ────────────────────────────────────────────────────────────────────────────────────────────────
// Dealerships pay the platform a subscription. The payment provider (Stripe, or the built-in sandbox when no Stripe key
// is configured) is the source of truth; these tables mirror it from webhooks so the admin can report without calling
// the provider. Amounts are in minor units (cents) of `currency`, exactly as the provider reports them.

export const billingProvider = pgEnum("billing_provider", ["stripe", "sandbox"])
export const billingInterval = pgEnum("billing_interval", ["month", "year"])
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
])
export const billingInvoiceStatus = pgEnum("billing_invoice_status", ["draft", "open", "paid", "void", "uncollectible"])
export const billingTransactionStatus = pgEnum("billing_transaction_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
])

const minorUnits = (name: string) => integer(name).notNull().default(0)
const currency = () => varchar("currency", { length: 3 }).notNull().default("kes")
const at = (name: string) => timestamp(name, { withTimezone: true })

export const billingPlans = pgTable(
  "billing_plans",
  {
    id: id(),
    code: varchar("code", { length: 64 }).notNull(),
    /** Null = a public plan every dealership can choose. Set = a custom plan only that dealership can see and pick. */
    dealershipId: uuid("dealership_id").references(() => dealerships.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    amount: integer("amount").notNull(),
    currency: currency(),
    interval: billingInterval("interval").notNull().default("month"),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Stripe prices are immutable: a price change creates a new Price and replaces this id. */
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("billing_plans_code_key").on(t.code), check("billing_plans_amount_positive", sql`${t.amount} > 0`)],
)

/** One per dealership: who the provider bills and the card on file. */
export const billingAccounts = pgTable(
  "billing_accounts",
  {
    dealershipId: uuid("dealership_id")
      .primaryKey()
      .references(() => dealerships.id, { onDelete: "restrict" }),
    email: text("email"),
    provider: billingProvider("provider").notNull(),
    providerCustomerId: text("provider_customer_id"),
    cardBrand: varchar("card_brand", { length: 20 }),
    cardLast4: varchar("card_last4", { length: 4 }),
    cardExpMonth: integer("card_exp_month"),
    cardExpYear: integer("card_exp_year"),
    /** Sandbox only: whether the simulated card on file approves or declines charges. */
    sandboxCardDeclines: boolean("sandbox_card_declines").notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex("billing_accounts_provider_customer_key").on(t.provider, t.providerCustomerId)],
)

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    dealershipId: dealershipId(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "restrict" }),
    provider: billingProvider("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    status: subscriptionStatus("status").notNull(),
    /** Price actually being charged (it can differ from the plan's current price after a price change). */
    amount: integer("amount").notNull(),
    currency: currency(),
    interval: billingInterval("interval").notNull().default("month"),
    currentPeriodStart: at("current_period_start").notNull(),
    currentPeriodEnd: at("current_period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: at("canceled_at"),
    trialEnd: at("trial_end"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("subscriptions_provider_id_key").on(t.provider, t.providerSubscriptionId),
    // A dealership has at most one live subscription; ended ones are kept as history.
    uniqueIndex("subscriptions_one_live_per_dealership")
      .on(t.dealershipId)
      .where(sql`${t.status} not in ('canceled', 'incomplete_expired')`),
    index("subscriptions_status_idx").on(t.status),
  ],
)

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    id: id(),
    dealershipId: dealershipId(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    provider: billingProvider("provider").notNull(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    number: text("number"),
    status: billingInvoiceStatus("status").notNull(),
    description: text("description"),
    amountDue: minorUnits("amount_due"),
    amountPaid: minorUnits("amount_paid"),
    amountRemaining: minorUnits("amount_remaining"),
    currency: currency(),
    periodStart: at("period_start"),
    periodEnd: at("period_end"),
    dueDate: at("due_date"),
    paidAt: at("paid_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextPaymentAttempt: at("next_payment_attempt"),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    issuedAt: at("issued_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("billing_invoices_provider_id_key").on(t.provider, t.providerInvoiceId),
    index("billing_invoices_dealership_idx").on(t.dealershipId, t.issuedAt),
    index("billing_invoices_status_idx").on(t.status),
  ],
)

/** Every charge attempt against a dealership (successful, failed or refunded). */
export const billingTransactions = pgTable(
  "billing_transactions",
  {
    id: id(),
    dealershipId: dealershipId(),
    invoiceId: uuid("invoice_id").references(() => billingInvoices.id, { onDelete: "set null" }),
    provider: billingProvider("provider").notNull(),
    providerTransactionId: text("provider_transaction_id").notNull(),
    status: billingTransactionStatus("status").notNull(),
    amount: integer("amount").notNull(),
    amountRefunded: minorUnits("amount_refunded"),
    fee: integer("fee"),
    currency: currency(),
    cardBrand: varchar("card_brand", { length: 20 }),
    cardLast4: varchar("card_last4", { length: 4 }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    receiptUrl: text("receipt_url"),
    occurredAt: at("occurred_at").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("billing_transactions_provider_id_key").on(t.provider, t.providerTransactionId),
    index("billing_transactions_dealership_idx").on(t.dealershipId, t.occurredAt),
    index("billing_transactions_status_idx").on(t.status),
  ],
)

/** Webhook/provider event log: makes delivery idempotent and gives the admin an audit trail. */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    provider: billingProvider("provider").notNull(),
    type: text("type").notNull(),
    dealershipId: uuid("dealership_id").references(() => dealerships.id, { onDelete: "set null" }),
    summary: text("summary"),
    payload: jsonb("payload"),
    receivedAt: at("received_at").notNull().defaultNow(),
    processedAt: at("processed_at"),
    error: text("error"),
  },
  (t) => [index("billing_events_received_idx").on(t.receivedAt)],
)

export const customersRelations = relations(customers, ({ many }) => ({
  agreements: many(agreements, { relationName: "buyer" }),
}))

export const agreementsRelations = relations(agreements, ({ one, many }) => ({
  customer: one(customers, { fields: [agreements.customerId], references: [customers.id], relationName: "buyer" }),
  car: one(cars, { fields: [agreements.carId], references: [cars.id] }),
  bankAccount: one(bankAccounts, { fields: [agreements.bankAccountId], references: [bankAccounts.id] }),
  tradeIns: many(agreementTradeIns),
  installments: many(installments),
  payments: many(payments),
  documents: many(agreementDocuments),
}))

export const agreementTradeInsRelations = relations(agreementTradeIns, ({ one }) => ({
  agreement: one(agreements, { fields: [agreementTradeIns.agreementId], references: [agreements.id] }),
  car: one(cars, { fields: [agreementTradeIns.carId], references: [cars.id] }),
}))

export const installmentsRelations = relations(installments, ({ one, many }) => ({
  agreement: one(agreements, { fields: [installments.agreementId], references: [agreements.id] }),
  payments: many(payments, { relationName: "paymentInstallment" }),
}))

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  agreement: one(agreements, { fields: [payments.agreementId], references: [agreements.id] }),
  installment: one(installments, {
    fields: [payments.installmentId],
    references: [installments.id],
    relationName: "paymentInstallment",
  }),
  allocations: many(paymentAllocations),
}))

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, { fields: [paymentAllocations.paymentId], references: [payments.id] }),
  installment: one(installments, { fields: [paymentAllocations.installmentId], references: [installments.id] }),
}))

export const agreementDocumentsRelations = relations(agreementDocuments, ({ one }) => ({
  agreement: one(agreements, { fields: [agreementDocuments.agreementId], references: [agreements.id] }),
}))

export type Dealership = typeof dealerships.$inferSelect
export type User = typeof users.$inferSelect
export type UserRole = (typeof userRole.enumValues)[number]
export type BankAccount = typeof bankAccounts.$inferSelect
export type Agreement = typeof agreements.$inferSelect
export type Installment = typeof installments.$inferSelect
export type Payment = typeof payments.$inferSelect
export type ProformaInvoice = typeof proformaInvoices.$inferSelect
export type FinalInvoice = typeof finalInvoices.$inferSelect
export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Car = typeof cars.$inferSelect
export type NewCar = typeof cars.$inferInsert
export type BillingPlan = typeof billingPlans.$inferSelect
export type BillingAccount = typeof billingAccounts.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type BillingInvoice = typeof billingInvoices.$inferSelect
export type BillingTransaction = typeof billingTransactions.$inferSelect
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number]
export type BillingInvoiceStatus = (typeof billingInvoiceStatus.enumValues)[number]
export type BillingTransactionStatus = (typeof billingTransactionStatus.enumValues)[number]
