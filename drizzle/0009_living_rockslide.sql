ALTER TABLE "role_config" RENAME COLUMN "min" TO "threshold";--> statement-breakpoint
ALTER TABLE "role_config" DROP COLUMN "max";