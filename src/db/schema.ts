import {
  doublePrecision,
  text,
  pgTable,
  timestamp,
  uuid,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").notNull(),
    guildId: text("guild_id").notNull().default("1418305021296251063"),
    balance: doublePrecision("balance").default(1000).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.id, t.guildId)],
);

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactionTypeEnum = pgEnum("transaction_type", ["buy", "sell"]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull().default("1418305021296251063"),
  assetId: text("asset_id")
    .references(() => assets.id)
    .notNull(),
  type: transactionTypeEnum("type").notNull(),
  shares: doublePrecision("shares").notNull(),
  pricePerShare: doublePrecision("price_per_share").notNull(),
  balanceBefore: doublePrecision("balance_before").notNull(),
  balanceAfter: doublePrecision("balance_after").notNull(),
  sharesBefore: doublePrecision("shares_before").notNull(),
  sharesAfter: doublePrecision("shares_after").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const prices = pgTable(
  "prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: text("asset_id")
      .references(() => assets.id)
      .notNull(),
    price: doublePrecision("price").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (t) => [unique().on(t.assetId, t.timestamp)],
);
