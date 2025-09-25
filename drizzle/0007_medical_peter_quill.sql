ALTER TABLE "prices" DROP CONSTRAINT "prices_timestamp_unique";--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_asset_id_timestamp_unique" UNIQUE("asset_id","timestamp");