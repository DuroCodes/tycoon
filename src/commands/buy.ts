import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { getUser, getLatestPrice } from "~/utils/database";
import { db } from "~/db/client";
import {
  cleanCompanyName,
  formatMoney,
  formatShares,
} from "~/utils/formatting";
import { assets, users, transactions } from "~/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { container } from "~/utils/components";
import { assignRoles } from "~/utils/assign-roles";
import { assetAutocomplete } from "~/utils/autocomplete";

export default commandModule({
  type: CommandType.Slash,
  description: "Buy assets",
  plugins: [databaseUser()],
  options: [
    {
      name: "asset",
      description: "The asset to buy shares of",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: assetAutocomplete,
    },
    {
      name: "amount",
      description: "The amount of shares to buy",
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
    const user = await getUser(ctx.user.id, ctx.guildId!);
    const type = ctx.options.getString("type", true);
    const amount = ctx.options.getNumber("amount", true);

    if (amount <= 0)
      return ctx.interaction.editReply({
        components: [
          container(
            "error",
            "Invalid buy amount. Please enter a positive number.",
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    const assetQuery = await db
      .select()
      .from(assets)
      .where(eq(assets.id, ctx.options.getString("asset", true)))
      .limit(1);

    if (!assetQuery.length)
      return ctx.interaction.editReply({
        components: [container("error", "Asset not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const asset = assetQuery[0];
    const latestPrice = await getLatestPrice(asset.id);

    if (!latestPrice)
      return ctx.interaction.editReply({
        components: [container("error", "Price not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const currentPrice = latestPrice.price;
    const shareAmount = type === "money" ? amount / currentPrice : amount;
    const moneyAmount = shareAmount * currentPrice;

    if (moneyAmount > user.balance) {
      const missing = formatMoney(moneyAmount - user.balance);
      return ctx.interaction.editReply({
        components: [
          container(
            "error",
            `You don't have enough money. You need ${missing} more.`,
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const latestTransaction = await db
      .select({ sharesAfter: transactions.sharesAfter })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.guildId, ctx.guildId!),
          eq(transactions.assetId, asset.id),
        ),
      )
      .orderBy(desc(transactions.timestamp))
      .limit(1);

    const sharesBefore = latestTransaction.length
      ? latestTransaction[0].sharesAfter
      : 0;

    await db.insert(transactions).values({
      userId: user.id,
      guildId: ctx.guildId!,
      assetId: asset.id,
      type: "buy",
      shares: shareAmount,
      pricePerShare: currentPrice,
      balanceBefore: user.balance,
      balanceAfter: user.balance - moneyAmount,
      sharesBefore,
      sharesAfter: sharesBefore + shareAmount,
    });

    await db
      .update(users)
      .set({ balance: user.balance - moneyAmount })
      .where(and(eq(users.id, user.id), eq(users.guildId, ctx.guildId!)));

    const money = formatMoney(moneyAmount);
    const company = cleanCompanyName(asset.name);
    const newBalance = formatMoney(user.balance - moneyAmount);

    await assignRoles(user.id, ctx.guildId!, ctx.client);

    return ctx.interaction.editReply({
      components: [
        container(
          "success",
          `**Amount:** ${money}\n**Shares:** ${formatShares(shareAmount)}\n**Asset:** ${asset.id} (${company})\n\n-# Your new balance is **${newBalance}**`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
