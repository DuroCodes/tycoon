import { db } from "~/db/client";
import { prices } from "~/db/schema";
import { createAsset } from "./create-asset";
import { getStockPrice } from "./yfinance";
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
) => {
  log("Starting scheduled price update...", sdt);

  for (const asset of assets) {
    const assetResult = await createAsset(asset);
    if (!assetResult.ok) {
      log(`Failed to create asset ${asset}: ${assetResult.error}`, sdt);
      continue;
    }

    const price = await getStockPrice(asset);

    if (!price.ok) {
      log(`Failed to update price for ${asset}: No price data available`, sdt);
      continue;
    }

    await db.insert(prices).values({
      assetId: asset,
      price: price.value,
    });

    log(`Updated price for ${asset}: ${price.value.toFixed(2)}`, sdt);
  }

  log("Completed scheduled price update.", sdt);
};
