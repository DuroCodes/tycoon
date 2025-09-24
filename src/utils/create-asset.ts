import { eq } from "drizzle-orm";
import { db } from "~/db/client";
import { assets } from "~/db/schema";
import { getStockInfo } from "./yfinance";
import { Err, Ok } from "./result";

export const createAsset = async (symbol: string) => {
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
