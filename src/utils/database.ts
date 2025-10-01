import { db } from "~/db/client";
import {
  assets,
  prices,
  roleConfig,
  transactions,
  transactionTypeEnum,
  users,
} from "~/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";
import { Err, Ok } from "./result";
import { getStockInfo } from "./yfinance";
import { assignRoles } from "./assign-roles";
import { Service } from "@sern/handler";

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

export const getUserWorthOverTime = async (
  userId: string,
  guildId: string,
  period: string = "7d",
) => {
  const now = new Date();
  const periodDays = {
    "1d": 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  } as const;

  const days = periodDays[period as keyof typeof periodDays] ?? 7;

  let startDate: Date;
  if (period === "1d") {
    const today = new Date(now);
    today.setHours(9, 30, 0, 0);
    startDate = today;

    if (now.getHours() < 9 || (now.getHours() === 9 && now.getMinutes() < 30)) {
      startDate.setDate(startDate.getDate() - 1);
    }
  } else {
    startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  const allUserTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.guildId, guildId)),
    )
    .orderBy(transactions.timestamp);

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

  const currentPortfolio = new Map<string, number>();

  for (const transaction of allUserTransactions) {
    const currentShares = currentPortfolio.get(transaction.assetId) || 0;
    const newShares =
      transaction.type === "buy"
        ? currentShares + transaction.shares
        : currentShares - transaction.shares;
    currentPortfolio.set(transaction.assetId, newShares);
  }

  const getSamplingConfig = (period: string) => {
    const SAMPLING_MAP = {
      "1d": {
        interval: 30 * 60 * 1000,
        endTime: new Date(startDate.getTime() + 6.5 * 60 * 60 * 1000),
      },
      "7d": {
        interval: 12 * 60 * 60 * 1000,
        endTime: now,
      },
      "30d": {
        interval: 24 * 60 * 60 * 1000,
        endTime: now,
      },
      "90d": {
        interval: 2 * 24 * 60 * 60 * 1000,
        endTime: now,
      },
      "1y": {
        interval: 7 * 24 * 60 * 60 * 1000,
        endTime: now,
      },
      default: {
        interval: 12 * 60 * 60 * 1000,
        endTime: now,
      },
    } as const;

    return (
      SAMPLING_MAP[period as keyof typeof SAMPLING_MAP] ?? SAMPLING_MAP.default
    );
  };

  const { interval, endTime } = getSamplingConfig(period);
  const worthOverTime = [];

  const balanceChanges = new Map<number, number>();
  for (const transaction of allUserTransactions) {
    const timeKey = transaction.timestamp.getTime();
    balanceChanges.set(timeKey, transaction.balanceAfter);
  }

  const initialBalance =
    allUserTransactions.length > 0
      ? allUserTransactions[0].balanceAfter -
        (allUserTransactions[0].type === "buy"
          ? allUserTransactions[0].shares * allUserTransactions[0].pricePerShare
          : -allUserTransactions[0].shares *
            allUserTransactions[0].pricePerShare)
      : (await getUser(userId, guildId)).balance;

  for (
    let time = startDate.getTime();
    time <= endTime.getTime();
    time += interval
  ) {
    const timestamp = new Date(time);

    const assetValue = await calculatePortfolioValue(
      currentPortfolio,
      timestamp,
    );

    let balance = initialBalance;
    for (const [transactionTime, transactionBalance] of balanceChanges) {
      if (transactionTime > time) break;
      balance = transactionBalance;
    }

    worthOverTime.push({
      value: balance + assetValue,
      timestamp,
    });
  }

  if (
    worthOverTime.length === 0 ||
    worthOverTime[worthOverTime.length - 1].timestamp.getTime() !==
      endTime.getTime()
  ) {
    const currentAssetValue = await calculatePortfolioValue(
      currentPortfolio,
      endTime,
    );

    const user = await getUser(userId, guildId);
    worthOverTime.push({
      value: user.balance + currentAssetValue,
      timestamp: endTime,
    });
  }

  return worthOverTime;
};

export const insertTransaction = async (
  userId: string,
  guildId: string,
  assetId: string,
  type: (typeof transactionTypeEnum.enumValues)[number],
  shares: number,
  pricePerShare: number,
  balanceBefore: number,
  balanceAfter: number,
  sharesBefore: number,
  sharesAfter: number,
) => {
  await db.insert(transactions).values({
    userId,
    guildId,
    assetId,
    type,
    shares,
    pricePerShare,
    balanceBefore,
    balanceAfter,
    sharesBefore,
    sharesAfter,
  });

  await assignRoles(userId, guildId, Service("@sern/client"));
};
