import { db } from "~/db/client";
import { assets, users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { Err, Ok } from "./result";
import { getStockInfo } from "./yfinance";

export const getUser = async (userId: string) => {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length) return existingUser[0];

  const newUser = await db.insert(users).values({ id: userId }).returning();
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
