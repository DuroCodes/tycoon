import { doublePrecision, text, pgTable } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  balance: doublePrecision("balance").default(0),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  symbol: text("symbol"),
});

export const userAssets = pgTable("user_assets", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  assetId: text("asset_id").references(() => assets.id),
  shares: doublePrecision("shares"),
});
