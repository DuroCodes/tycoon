import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { getUser } from "~/utils/database";
import { db } from "~/db/client";
import { cleanCompanyName, formatMoney } from "~/utils/formatting";
import { assets, prices, users, transactions } from "~/db/schema";
import { or, ilike, eq, desc, and } from "drizzle-orm";
import { container } from "~/utils/components";

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
      command: {
        execute: async (ctx) => {
          const focus = ctx.options.getFocused();

          const asset = await db
            .select()
            .from(assets)
            .where(
              or(
                ilike(assets.id, `%${focus}%`),
                ilike(assets.name, `%${focus}%`)
              )
            )
            .limit(25);

          await ctx.respond(
            asset.map((a) => ({
              name: `${a.id} (${cleanCompanyName(a.name)})`,
              value: a.id,
            }))
          );
        },
      },
    },
    {
      name: "amount",
      description: "The amount of shares to buy",
      type: ApplicationCommandOptionType.Number,
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
    const user = await getUser(ctx.user.id);
    const type = ctx.options.getString("type", true);
    const amount = ctx.options.getNumber("amount", true);
    const assetQuery = await db
      .select()
      .from(assets)
      .where(eq(assets.id, ctx.options.getString("asset", true)))
      .limit(1);

    if (!assetQuery.length)
      return ctx.reply({
        components: [container("error", "Asset not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const asset = assetQuery[0];

    const currentPrice = (
      await db
        .select()
        .from(prices)
        .where(eq(prices.assetId, asset.id))
        .orderBy(desc(prices.timestamp))
        .limit(1)
    )[0].price;

    const shareAmount = type === "money" ? amount / currentPrice : amount;
    const moneyAmount = shareAmount * currentPrice;

    if (moneyAmount > user.balance) {
      return ctx.reply({
        components: [container("error", "Not enough money")],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const latestTransaction = await db
      .select({ sharesAfter: transactions.sharesAfter })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.assetId, asset.id)
        )
      ).orderBy(desc(transactions.timestamp))
      .limit(1);

    const sharesBefore = latestTransaction.length ? latestTransaction[0].sharesAfter : 0

    await db
      .update(users)
      .set({ balance: user.balance - moneyAmount })
      .where(eq(users.id, user.id));

    await db
      .insert(transactions)
      .values({
        userId: user.id,
        assetId: asset.id,
        type: "buy",
        shares: shareAmount,
        pricePerShare: currentPrice,
        balanceBefore: user.balance,
        balanceAfter: user.balance - moneyAmount,
        sharesBefore,
        sharesAfter: sharesBefore + shareAmount,
      })

    return ctx.reply({
      components: [
        container(
          "success",
          `You bought ${formatMoney(moneyAmount)} (${
            Number.isInteger(shareAmount) ? shareAmount : shareAmount.toFixed(4)
          } share${shareAmount === 1 ? "" : "s"}) of ${asset.id} (${
            asset.name
          })`
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
