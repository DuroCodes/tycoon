ALTER TABLE "users" ALTER COLUMN "balance" SET DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "total_amount";--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_timestamp_unique" UNIQUE("timestamp");