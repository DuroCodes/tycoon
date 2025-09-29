import { db } from "~/db/client";
import { assets, users, prices, transactions, roleConfig } from "~/db/schema";
import { eq, desc, and, lte } from "drizzle-orm";
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

export const getPriceAtTime = async (assetId: string, atTimestamp: Date) => {
  const priceQuery = await db
    .select()
    .from(prices)
    .where(and(eq(prices.assetId, assetId), lte(prices.timestamp, atTimestamp)))
    .orderBy(desc(prices.timestamp))
    .limit(1);

  return priceQuery.length > 0 ? priceQuery[0] : null;
};

export const getRoleConfig = async (guildId: string, roleId: string) => {
  const config = await db
    .select()
    .from(roleConfig)
    .where(and(eq(roleConfig.guildId, guildId), eq(roleConfig.roleId, roleId)))
    .limit(1);

  return config.length > 0 ? config[0] : null;
};

export const getAllRoleConfigs = async (guildId: string) => {
  const configs = await db
    .select()
    .from(roleConfig)
    .where(eq(roleConfig.guildId, guildId))
    .orderBy(desc(roleConfig.threshold));

  return configs;
};

export const getUserWorthOverTime = async (userId: string, guildId: string) => {
  const userTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.guildId, guildId)),
    )
    .orderBy(transactions.timestamp);

  if (!userTransactions.length) {
    const user = await getUser(userId, guildId);
    return [
      {
        value: user.balance,
        timestamp: new Date(),
      },
    ];
  }

  const worthOverTime = [];
  let portfolio = new Map<string, number>();

  const calculatePortfolioValue = async (
    portfolio: Map<string, number>,
    atTimestamp: Date,
  ) => {
    const pricePromises = Array.from(portfolio.entries())
      .filter(([, shares]) => shares > 0)
      .map(async ([assetId, shares]) => {
        const price = await getPriceAtTime(assetId, atTimestamp);
        return price ? shares * price.price : 0;
      });

    const values = await Promise.all(pricePromises);
    return values.reduce((sum, value) => sum + value, 0);
  };

  for (const transaction of userTransactions) {
    const currentShares = portfolio.get(transaction.assetId) || 0;
    const newShares =
      transaction.type === "buy"
        ? currentShares + transaction.shares
        : currentShares - transaction.shares;

    portfolio.set(transaction.assetId, newShares);

    const assetValue = await calculatePortfolioValue(
      portfolio,
      transaction.timestamp,
    );
    worthOverTime.push({
      value: transaction.balanceAfter + assetValue,
      timestamp: transaction.timestamp,
    });
  }

  if (userTransactions.length > 0) {
    const currentUser = await getUser(userId, guildId);
    const currentAssetValue = await calculatePortfolioValue(
      portfolio,
      new Date(),
    );

    worthOverTime.push({
      value: currentUser.balance + currentAssetValue,
      timestamp: new Date(),
    });
  }

  console.log(worthOverTime);

  return worthOverTime;
};
