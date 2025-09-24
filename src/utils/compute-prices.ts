import { db } from "~/db/client";
import { prices } from "~/db/schema";
import { createAsset } from "./database";
import { getStockHistoricalPrice } from "./yfinance";
import { ALL_ASSETS } from "./assets";
import { scheduledTask } from "@sern/handler";

type TaskAttributes = Parameters<
  Parameters<typeof scheduledTask>[0]["execute"]
>[1];

const log = (message: string, sdt?: TaskAttributes) => {
  if (sdt) sdt.deps["@sern/logger"]?.debug({ message });
  else console.log(message);
};

export const computeAssetPrices = async (
  sdt?: TaskAttributes,
  assets = ALL_ASSETS,
  days = 1,
) => {
  log("Starting scheduled price update...", sdt);

  for (const asset of assets) {
    const assetResult = await createAsset(asset);
    if (!assetResult.ok) {
      log(`Failed to create asset ${asset}: ${assetResult.error}`, sdt);
      continue;
    }

    const priceData = await getStockHistoricalPrice(asset, days);

    if (!priceData.ok) {
      log(`Failed to update price for ${asset}: No price data available`, sdt);
      continue;
    }

    const priceEntries = priceData.value.prices.map((price, index) => ({
      assetId: asset,
      price,
      timestamp: priceData.value.timestamps[index],
    }));

    await db
      .insert(prices)
      .values(priceEntries)
      .onConflictDoUpdate({
        target: [prices.assetId, prices.timestamp],
        set: {
          price: prices.price,
        },
      });

    log(
      `Updated ${priceData.value.prices.length} price entries for ${asset}`,
      sdt,
    );
  }

  log("Completed scheduled price update.", sdt);
};
