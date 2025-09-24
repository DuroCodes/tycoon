import { commandModule, CommandType } from "@sern/handler";
import {
  Colors,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { eq, ilike, desc, or } from "drizzle-orm";
import { db } from "~/db/client";
import { assets, prices } from "~/db/schema";
import { container } from "~/utils/components";
import { cleanCompanyName, formatMoney } from "~/utils/formatting";

export default commandModule({
  type: CommandType.Slash,
  description: "View information on a specific stock ticker",
  options: [
    {
      name: "asset",
      description: "The asset to view information on",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: {
        execute: async (ctx) => {
          const focus = ctx.options.getFocused();

          const asset = await db
            .select()
            .from(assets)
            .where(
              or(
                ilike(assets.id, `%${focus}%`),
                ilike(assets.name, `%${focus}%`),
              ),
            )
            .limit(25);

          await ctx.respond(
            asset.map((a) => ({
              name: `${a.id} (${cleanCompanyName(a.name)})`,
              value: a.id,
            })),
          );
        },
      },
    },
  ],
  execute: async (ctx) => {
    const assetId = ctx.options.getString("asset", true);

    const dbAsset = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (dbAsset.length)
      return ctx.reply({
        components: [container("error", "Asset not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const asset = dbAsset[0];

    const latestPrice = await db
      .select()
      .from(prices)
      .where(eq(prices.assetId, asset.id))
      .orderBy(desc(prices.timestamp))
      .limit(1);

    const displayPrice = latestPrice.length > 0 ? latestPrice[0].price : null;

    const getSentences = (text: string, n = 1) => {
      if (!text) return "";

      const sentences = text
        .split(/\.(?=\s+[A-Z])|\.(?=\s*$)/) // stops "company inc." from being split
        .filter((s) => s.trim());

      const selectedSentences = sentences.slice(0, n);
      let result = selectedSentences.join(".").trim();
      if (result && !result.endsWith(".")) result += ".";

      return result;
    };

    const description = getSentences(asset.description);

    const assetContainer = new ContainerBuilder({
      accent_color: Colors.Blue,
      components: [
        new TextDisplayBuilder({
          content: `### ${asset.name} • \` ${asset.id} \``,
        }).toJSON(),
        new TextDisplayBuilder({
          content: `**${asset.id}** - ${asset.name}`,
        }).toJSON(),
        new TextDisplayBuilder({
          content: `${description}`,
        }).toJSON(),
        new TextDisplayBuilder({
          content: displayPrice
            ? `💰 **Current Price:** ${formatMoney(displayPrice)}`
            : "💰 **Price:** Not available",
        }).toJSON(),
      ],
    });

    await ctx.reply({
      components: [assetContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
