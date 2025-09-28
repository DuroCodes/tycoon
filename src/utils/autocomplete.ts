import type { AutocompleteInteraction, CacheType } from "discord.js";
import { db } from "~/db/client";
import { assets } from "~/db/schema";
import { or, ilike } from "drizzle-orm";
import { cleanCompanyName } from "~/utils/formatting";

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
