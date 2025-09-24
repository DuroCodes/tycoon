import { commandModule, CommandType } from "@sern/handler";
import {
  Colors,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  AttachmentBuilder,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { eq, ilike, desc, or } from "drizzle-orm";
import { db } from "~/db/client";
import { assets, prices } from "~/db/schema";
import { container } from "~/utils/components";
import { cleanCompanyName, formatMoney } from "~/utils/formatting";
import { generateStockChartPng } from "~/utils/stock-image";

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

    if (!dbAsset.length)
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

    // Fetch price history for chart generation
    const priceHistory = await db
      .select({
        price: prices.price,
        timestamp: prices.timestamp,
      })
      .from(prices)
      .where(eq(prices.assetId, asset.id))
      .orderBy(prices.timestamp);

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
          content: `### ${cleanCompanyName(asset.name)} - \`${asset.id}\``,
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

    // Generate chart if we have enough price data
    let chartAttachment: AttachmentBuilder | undefined;
    console.log(priceHistory.length);
    if (priceHistory.length >= 2) {
      try {
        console.log("Generating chart");
        const chartBuffer = await generateStockChartPng(
          asset.id,
          priceHistory,
          800,
          300,
        );
        console.log("Chart generated");
        chartAttachment = new AttachmentBuilder(chartBuffer, {
          name: `${asset.id}-chart.png`,
        });
      } catch (error) {
        console.error("Failed to generate chart:", error);
        // Continue without chart if generation fails
      }
    }
    

    const replyOptions: any = {
      components: [assetContainer],
      flags: MessageFlags.IsComponentsV2,
    };
    console.log("Reply options", replyOptions);

    if (chartAttachment) {
      replyOptions.files = [chartAttachment];
    }
    console.log("Reply options", replyOptions);

    await ctx.reply({
      files: [chartAttachment!],
    });
  },
});
