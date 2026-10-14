CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'dealer_admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"dealership_id" uuid,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_dealership" CHECK (("users"."role" = 'super_admin' and "users"."dealership_id" is null) or ("users"."role" = 'dealer_admin' and "users"."dealership_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "billing_plans" ALTER COLUMN "code" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN "dealership_id" uuid;--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "country" text DEFAULT 'KE' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "brand_title" text;--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "logo_mime_type" varchar(40);--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "logo_wide" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "sidebar_color" varchar(7);--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "accent_color" varchar(7);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_dealership_idx" ON "users" USING btree ("dealership_id");--> statement-breakpoint
ALTER TABLE "billing_plans" ADD CONSTRAINT "billing_plans_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_sidebar_color_hex" CHECK ("dealerships"."sidebar_color" is null or "dealerships"."sidebar_color" ~ '^#[0-9a-fA-F]{6}$');--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_accent_color_hex" CHECK ("dealerships"."accent_color" is null or "dealerships"."accent_color" ~ '^#[0-9a-fA-F]{6}$');