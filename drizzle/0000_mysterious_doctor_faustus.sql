CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text
);
--> statement-breakpoint
CREATE TABLE "user_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"asset_id" text,
	"shares" double precision
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"balance" double precision DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;