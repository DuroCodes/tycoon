CREATE TABLE "role_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"min" double precision NOT NULL,
	"max" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_config_guild_id_role_id_unique" UNIQUE("guild_id","role_id")
);
--> statement-breakpoint
