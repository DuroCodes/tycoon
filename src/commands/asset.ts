import { commandModule, CommandType } from "@sern/handler";
import {
  MessageFlags,
  TextDisplayBuilder,
  AttachmentBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  APIComponentInContainer,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { eq, and, gte } from "drizzle-orm";
import { db } from "~/db/client";
import { assets, prices } from "~/db/schema";
import { container, EMOJI_MAP } from "~/utils/components";
import { cleanCompanyName, formatMoney } from "~/utils/formatting";
import { generateValueChartPng } from "~/utils/stock-image";
import { getLatestPrice } from "~/utils/database";
import { assetAutocomplete } from "~/utils/autocomplete";

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
      command: assetAutocomplete,
    },
    {
      name: "period",
      description: "Time period for the chart",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "1 Day", value: "1d" },
        { name: "7 Days", value: "7d" },
        { name: "30 Days", value: "30d" },
        { name: "90 Days", value: "90d" },
        { name: "1 Year", value: "1y" },
      ],
    },
  ],
  execute: async (ctx) => {
    const assetId = ctx.options.getString("asset", true);
    const period = ctx.options.getString("period") || "30d";

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

    const latestPrice = await getLatestPrice(asset.id);
    const displayPrice = latestPrice?.price ?? null;

    const now = new Date();
    const periodDays = {
      "1d": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    } as const;

    const days = periodDays[period as keyof typeof periodDays] ?? 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const priceHistory = await db
      .select({
        price: prices.price,
        timestamp: prices.timestamp,
      })
      .from(prices)
      .where(
        and(eq(prices.assetId, asset.id), gte(prices.timestamp, startDate)),
      )
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

    const shortDescription = getSentences(asset.description);

    if (priceHistory.length < 2) {
      return ctx.reply({
        components: [
          container("error", "No price history available for this period"),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const priceChange = priceHistory.at(-1)!.price >= priceHistory[0].price;
    const priceChangeMode = priceChange ? "gain" : "loss";
    const priceChangeEmoji = EMOJI_MAP[priceChangeMode];

    let chartAttachment: AttachmentBuilder | undefined;
    if (priceHistory.length >= 1) {
      try {
        const chartData =
          priceHistory.length === 1
            ? [
                {
                  value: priceHistory[0].price,
                  timestamp: priceHistory[0].timestamp,
                },
                {
                  value: priceHistory[0].price,
                  timestamp: priceHistory[0].timestamp,
                },
              ]
            : priceHistory.map((p) => ({
                value: p.price,
                timestamp: p.timestamp,
              }));

        const chartBuffer = await generateValueChartPng(chartData, {
          width: 800,
          height: 300,
          period: period,
        });
        chartAttachment = new AttachmentBuilder(chartBuffer, {
          name: `${asset.id}-chart-${period}.png`,
        });
      } catch (error) {
        console.error("Failed to generate chart:", error);
      }
    }

    const components: APIComponentInContainer[] = [
      new TextDisplayBuilder({
        content: `${shortDescription}`,
      }).toJSON(),
    ];

    if (chartAttachment) {
      components.push(
        new MediaGalleryBuilder({
          items: [
            new ThumbnailBuilder({
              media: { url: `attachment://${asset.id}-chart-${period}.png` },
            }).toJSON(),
          ],
        }).toJSON(),
      );
    }

    components.push(
      new TextDisplayBuilder({
        content: displayPrice
          ? `-# **Price:** ${formatMoney(displayPrice)}`
          : "-# Price not available",
      }).toJSON(),
    );

    const attachments = chartAttachment ? [chartAttachment] : [];

    await ctx.reply({
      components: [
        container(
          priceChangeMode,
          components,
          `### ${priceChangeEmoji} ${cleanCompanyName(asset.name)} - \`${asset.id}\``,
        ),
      ],
      files: attachments,
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
