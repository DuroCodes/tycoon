import { db } from "~/db/client";
import { assets, users, prices, transactions } from "~/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Err, Ok } from "./result";
import { getStockInfo } from "./yfinance";

export const getUser = async (userId: string, guildId: string) => {
  const existingUser = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.guildId, guildId)))
    .limit(1);

  if (existingUser.length) return existingUser[0];

  const newUser = await db
    .insert(users)
    .values({ id: userId, guildId })
    .returning();
  return newUser[0];
};

export const getAsset = async (symbol: string) => {
  const existingAsset = await db
    .select()
    .from(assets)
    .where(eq(assets.id, symbol))
    .limit(1);

  if (existingAsset.length) return Ok(existingAsset[0]);

  const stockInfo = await getStockInfo(symbol);
  if (!stockInfo.ok)
    return Err(`Failed to create asset ${symbol}: ${stockInfo.error}`);

  const newAsset = await db
    .insert(assets)
    .values({
      id: symbol,
      name: stockInfo.value.name,
      description: stockInfo.value.description,
    })
    .returning();

  return Ok(newAsset[0]);
};

export const getLatestPrice = async (assetId: string) => {
  const priceQuery = await db
    .select()
    .from(prices)
    .where(eq(prices.assetId, assetId))
    .orderBy(desc(prices.timestamp))
    .limit(1);

  return priceQuery.length > 0 ? priceQuery[0] : null;
};

export const getUserBalanceOverTime = async (
  userId: string,
  guildId: string,
) => {
  const userTransactions = await db
    .select({
      balanceAfter: transactions.balanceAfter,
      timestamp: transactions.timestamp,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.guildId, guildId)),
    )
    .orderBy(transactions.timestamp);

  // If user has no transactions, get their current balance
  if (userTransactions.length === 0) {
    const user = await getUser(userId, guildId);
    return [
      {
        value: user.balance,
        timestamp: new Date(),
      },
    ];
  }

  return userTransactions.map((t) => ({
    value: t.balanceAfter,
    timestamp: t.timestamp,
  }));
};
