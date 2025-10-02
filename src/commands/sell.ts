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
import { and, eq } from "drizzle-orm";
import { container, EMOJI_MAP } from "~/utils/components";
import { getLatestPrice, getUser, insertTransaction } from "~/utils/database";
import { ownedAssetAutocomplete } from "~/utils/autocomplete";

export default commandModule({
  type: CommandType.Slash,
  description: "Sell assets",
  plugins: [databaseUser()],
  options: [
    {
      name: "asset",
      description: "The asset to sell shares of",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: ownedAssetAutocomplete,
    },
    {
      name: "amount",
      description: "The amount of shares to sell",
      type: ApplicationCommandOptionType.Number,
      min_value: 0,
      required: true,
    },
    {
      name: "type",
      description: "The type of transaction",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: "shares",
          value: "shares",
        },
        {
          name: "money",
          value: "money",
        },
      ],
    },
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const { ownedAssets } = await getPortfolioData(ctx.user.id, ctx.guildId!);
    const asset = ownedAssets.find(
      (asset) => asset.assetId === ctx.options.getString("asset", true),
    );

    if (!asset)
      return ctx.interaction.editReply({
        components: [container("error", "You do not own that asset")],
        flags: MessageFlags.IsComponentsV2,
      });

    const assetName = (
      await db
        .select()
        .from(assets)
        .where(eq(assets.id, asset.assetId))
        .limit(1)
    )[0].name;

    const amount = ctx.options.getNumber("amount", true);
    const type = ctx.options.getString("type", true);
    const latestPrice = (await getLatestPrice(asset.assetId))!.price;
    const shareAmount = type === "money" ? amount / latestPrice : amount;

    if (asset.shares < shareAmount)
      return ctx.interaction.editReply({
        components: [container("error", "You do not have enough shares")],
        flags: MessageFlags.IsComponentsV2,
      });

    const { balance: balanceBefore } = await getUser(ctx.user.id, ctx.guildId!);

    const balanceAfter = balanceBefore + shareAmount * latestPrice;

    const difference = asset.difference * shareAmount;

    const changeEmoji =
      difference > 0
        ? EMOJI_MAP.gain
        : difference < 0
          ? EMOJI_MAP.loss
          : EMOJI_MAP.neutral;

    await db
      .update(users)
      .set({ balance: balanceAfter })
      .where(and(eq(users.id, ctx.user.id), eq(users.guildId, ctx.guildId!)));

    await insertTransaction(
      ctx.user.id,
      ctx.guildId!,
      asset.assetId,
      "sell",
      shareAmount,
      latestPrice,
      balanceBefore,
      balanceAfter,
      asset.shares,
      asset.shares - shareAmount,
    );

    return ctx.interaction.editReply({
      components: [
        container(
          "success",
          `**Amount:** ${formatMoney(shareAmount * latestPrice)} (${changeEmoji + formatMoney(Math.abs(difference))})\n**Shares:** ${formatShares(shareAmount)}\n**Asset:** ${asset.assetId} (${cleanCompanyName(assetName)})\n\n-# Your new balance is **${formatMoney(balanceAfter)}**`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
