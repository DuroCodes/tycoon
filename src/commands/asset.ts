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
import { formatMoney } from "~/utils/format-money";

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

          const cleanCompanyName = (name: string) =>
            name
              .replace(
                /\s*(?:,\s*)?(Inc\.?|Corporation|Corp\.?|Ltd\.?|LLC|Company|Co\.?|Incorporated|Holdings)$/i,
                "",
              )
              .trim();

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

    if (dbAsset.length === 0) return ctx.reply("Asset not found in database");

    const asset = dbAsset[0];

    const latestPrice = await db
      .select()
      .from(prices)
      .where(eq(prices.assetId, assetId))
      .orderBy(desc(prices.timestamp))
      .limit(1);

    const displayPrice = latestPrice.length > 0 ? latestPrice[0].price : null;

    const getFirstSentence = (text: string) => {
      const match = text.match(/^.*?\.(?=\s+[A-Z])/);
      return match ? `${match[0]}` : `${text.split(".")[0]}`;
    };

    const description = getFirstSentence(asset.description);

    const container = new ContainerBuilder({
      accent_color: Colors.Blue,
      components: [
        new TextDisplayBuilder({ content: "### Asset Information" }).toJSON(),
        new TextDisplayBuilder({
          content: `**${assetId}** - ${asset.name}`,
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
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
