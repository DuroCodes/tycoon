import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import {
  cleanCompanyName,
  formatMoney,
  formatShares,
} from "~/utils/formatting";
import { getPortfolioData } from "~/utils/portfolio";
import { db } from "~/db/client";
import { assets, users } from "~/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { container, EMOJI_MAP } from "~/utils/components";
import { getLatestPrice, getUser, insertTransaction } from "~/utils/database";

export default commandModule({
  type: CommandType.Slash,
  description: "Sell all shares",
  plugins: [databaseUser()],
  options: [
    {
      name: "asset",
      description: "The asset to sell shares of",
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: true,
      command: {
        execute: async (ctx) => {
          const focus = ctx.options.getFocused();
          const { ownedAssets } = await getPortfolioData(
            ctx.user.id,
            ctx.guildId!,
          );

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
      },
    },
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const { ownedAssets } = await getPortfolioData(ctx.user.id, ctx.guildId!);
    const assets = [];

    if (ctx.options.getString("asset")) {
      const foundAsset = ownedAssets.find(
        (asset) => asset.assetId === ctx.options.getString("asset"),
      );

      if (!foundAsset)
        return ctx.interaction.editReply({
          components: [container("error", "You do not own that asset")],
          flags: MessageFlags.IsComponentsV2,
        });

      assets.push(foundAsset);
    } else {
      assets.push(...ownedAssets);
      if (assets.length === 0)
        return ctx.interaction.editReply({
          components: [container("error", "You do not own any assets")],
          flags: MessageFlags.IsComponentsV2,
        });
    }

    const latestPrices = await Promise.all(
      assets.map((a) => getLatestPrice(a.assetId).then((res) => res!.price)),
    );

    const shareAmounts = assets.map((a) => a.shares);

    const moneyAmounts = shareAmounts.map((a, i) => a * latestPrices[i]);

    const { balance: initialBalance } = await getUser(
      ctx.user.id,
      ctx.guildId!,
    );

    const balancesAfter = moneyAmounts.reduce<number[]>((acc, curr, i) => {
      const prev = i === 0 ? initialBalance : acc[i - 1];
      acc.push(prev + curr);
      return acc;
    }, []);

    const balancesBefore = [
      initialBalance,
      ...balancesAfter.slice(0, Math.max(0, balancesAfter.length - 1)),
    ];

    const finalBalance = balancesAfter[balancesAfter.length - 1];

    const differences = assets.map((a, i) => a.difference * shareAmounts[i]);

    const changeEmojis = differences.map((d) => {
      if (d > 0) return EMOJI_MAP.gain;
      if (d < 0) return EMOJI_MAP.loss;
      return EMOJI_MAP.neutral;
    });

    const overallChange = differences.reduce((acc, curr) => acc + curr, 0);

    const overallChangeString =
      overallChange > 0 ? "gain" : overallChange < 0 ? "loss" : "neutral";

    const overallChangeEmoji = EMOJI_MAP[overallChangeString];

    await db
      .update(users)
      .set({ balance: finalBalance })
      .where(and(eq(users.id, ctx.user.id), eq(users.guildId, ctx.guildId!)));

    assets.forEach(async (asset, i) => {
      await insertTransaction(
        ctx.user.id,
        ctx.guildId!,
        asset.assetId,
        "sell",
        shareAmounts[i],
        latestPrices[i],
        balancesBefore[i],
        balancesAfter[i],
        asset.shares,
        asset.shares - shareAmounts[i],
      );
    });

    const replyString = assets
      .map(
        (asset, i) =>
          `- ${changeEmojis[i]} ${asset.assetId} • ${formatMoney(shareAmounts[i] * latestPrices[i])} (${formatMoney(differences[i])}) • ${formatShares(shareAmounts[i])}`,
      )
      .join("\n");

    return ctx.interaction.editReply({
      components: [
        container(
          overallChangeString,
          replyString,
          `### ${overallChangeEmoji} Sold Assets`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
