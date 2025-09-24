ALTER TABLE "users" ALTER COLUMN "balance" SET DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "unique_asset_timestamp" UNIQUE("asset_id","timestamp");