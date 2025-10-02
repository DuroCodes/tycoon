import type { AutocompleteInteraction, CacheType } from "discord.js";
import { db } from "~/db/client";
import { assets } from "~/db/schema";
import { or, ilike, inArray } from "drizzle-orm";
import { cleanCompanyName } from "~/utils/formatting";
import { getPortfolioData } from "~/utils/portfolio";

export const assetAutocomplete = {
  execute: async (ctx: AutocompleteInteraction<CacheType>) => {
    const focus = ctx.options.getFocused();

    const asset = await db
      .select()
      .from(assets)
      .where(
        or(ilike(assets.id, `%${focus}%`), ilike(assets.name, `%${focus}%`)),
      )
      .limit(25);

    await ctx.respond(
      asset.map((a) => ({
        name: `${a.id} (${cleanCompanyName(a.name)})`,
        value: a.id,
      })),
    );
  },
};

export const ownedAssetAutocomplete = {
  execute: async (ctx: AutocompleteInteraction<CacheType>) => {
    const focus = ctx.options.getFocused();
    const { ownedAssets } = await getPortfolioData(ctx.user.id, ctx.guildId!);

    const ownedAssetIds = ownedAssets.map((asset) => asset.assetId);

    const dbAssets = await db
      .select()
      .from(assets)
      .where(inArray(assets.id, ownedAssetIds));

    const filteredAssets = dbAssets
      .filter(
        (asset) =>
          asset.id.toLowerCase().includes(focus.toLowerCase()) ||
          asset.name.toLowerCase().includes(focus.toLowerCase()),
      )
      .slice(0, 25);

    await ctx.respond(
      filteredAssets.map((a) => ({
        name: `${a.id} (${cleanCompanyName(a.name)})`,
        value: a.id,
      })),
    );
  },
};
