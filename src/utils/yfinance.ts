import { z } from "zod";
import { zodFetch } from "./fetch";
import { Err, Ok } from "./result";

const YFinanceInfoSchema = z.object({
  symbol: z.string(),
  longName: z.string().optional(),
  shortName: z.string().optional(),
  longBusinessSummary: z.string().optional(),
  shortBusinessSummary: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  marketCap: z.number().optional(),
  currency: z.string().optional(),
  exchange: z.string().optional(),
});

const YFinanceHistoricalSchema = z.array(
  z.object({
    close: z.number(),
    dividends: z.number(),
    high: z.number(),
    low: z.number(),
    open: z.number(),
    stockSplits: z.number(),
    timestamp: z.string(),
    volume: z.number(),
  }),
);

export const getStockInfo = async (symbol: string) => {
  const res = await zodFetch(
    YFinanceInfoSchema,
    "Failed to fetch stock info",
    `https://yfinancerestapi.com/api/v1/finance/stocks/info?ticker=${symbol}`,
  );

  if (!res.ok) return Err("Failed to fetch stock info");

  const info = res.value;
  const name = info.longName || info.shortName || symbol;
  const description =
    info.longBusinessSummary ||
    info.shortBusinessSummary ||
    `Stock information for ${symbol}`;

  return Ok({
    symbol: info.symbol,
    name,
    description,
  });
};

export const getStockPrice = async (symbol: string) => {
  const res = await zodFetch(
    YFinanceHistoricalSchema,
    "Failed to fetch stock price",
    `https://yfinancerestapi.com/api/v1/finance/stocks/historical?ticker=${symbol}&period=1d`,
  );

  if (!res.ok) return Err("Failed to fetch stock price");
  return Ok(res.value[0].close);
};
