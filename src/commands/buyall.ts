import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { getLatestPrice, getUser, insertTransaction } from "~/utils/database";
import { db } from "~/db/client";
import {
  cleanCompanyName,
  formatMoney,
  formatShares,
} from "~/utils/formatting";
import { assets, transactions, users } from "~/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { container } from "~/utils/components";
import { assetAutocomplete } from "~/utils/autocomplete";

export default commandModule({
  type: CommandType.Slash,
  description: "Buy as many shares of an asset as possible",
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
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const user = await getUser(ctx.user.id, ctx.guildId!);

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
    const shareAmount = user.balance / currentPrice;

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
      
    await db
      .update(users)
      .set({ balance: 0 })
      .where(and(eq(users.id, user.id), eq(users.guildId, ctx.guildId!)));
    
    await insertTransaction(
      user.id,
      ctx.guildId!,
      asset.id,
      "buy",
      shareAmount,
      currentPrice,
      user.balance,
      0,
      sharesBefore,
      sharesBefore + shareAmount, 
    );

    const money = formatMoney(user.balance);
    const company = cleanCompanyName(asset.name);
    const newBalance = formatMoney(0);

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
