ALTER TABLE "assets" DROP CONSTRAINT "assets_symbol_unique";--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "symbol";