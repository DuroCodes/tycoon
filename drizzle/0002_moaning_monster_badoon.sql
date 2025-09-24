CREATE TYPE "public"."transaction_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"shares" double precision NOT NULL,
	"price_per_share" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"balance_before" double precision NOT NULL,
	"balance_after" double precision NOT NULL,
	"shares_before" double precision NOT NULL,
	"shares_after" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_assets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "user_assets" ALTER COLUMN "shares" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_assets" ADD COLUMN "average_cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_assets" ADD COLUMN "total_invested" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_assets" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_assets" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_symbol_unique" UNIQUE("symbol");
