import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { createUser } from "~/utils/database";
import { db } from "~/db/client";
import { cleanCompanyName, formatMoney } from "~/utils/formatting";
import { assets, prices, users } from "~/db/schema";
import { or, ilike, eq, desc } from "drizzle-orm";
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
    const user = await createUser(ctx.user.id);

    // Get the purchase type (either "money" or "shares")
    const type = ctx.options.getString("type", true);
    
    // Get the amount to purchase (either money amount or number of shares)
    const amount = ctx.options.getNumber("amount", true);
    
    // Query the database to find the asset by ID
    const assetQuery = await db
      .select()
      .from(assets)
      .where(eq(assets.id, ctx.options.getString("asset", true)))
      .limit(1);

    // Check if asset exists in database
    if (!assetQuery.length)
      return ctx.reply({
        components: [container("error", "Asset not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const asset = assetQuery[0];
    
    // Get the current price of the asset (latest price entry)
    const currentPrice = (
      await db
        .select()
        .from(prices)
        .where(eq(prices.assetId, asset.id))
        .orderBy(desc(prices.timestamp))
        .limit(1)
    )[0].price;

    // Calculate share amount and money amount based on purchase type
    // If type is "money", calculate how many shares can be bought with that money
    // If type is "shares", use the specified number of shares
    const shareAmount = type === "money" ? amount / currentPrice : amount;
    const moneyAmount = shareAmount * currentPrice;

    // Check if user has sufficient balance
    if (moneyAmount > user.balance) {
      return ctx.reply({
        components: [container("error", "Not enough money")],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Deduct the money amount from user's balance
    await db
      .update(users)
      .set({ balance: user.balance - moneyAmount })
      .where(eq(users.id, user.id));

    // TODO: Record transaction details
    // Fields to track:
    // - userid: user.id
    // - assetid: asset.id
    // - type: purchase type ("money" or "shares")
    // - shares: shareAmount
    // - pricePerShare: currentPrice
    // - totalAmount: moneyAmount
    // - balanceBefore: user.balance
    // - balanceAfter: user.balance - moneyAmount
    // - sharesBefore: current user shares for this asset
    // - sharesAfter: sharesBefore + shareAmount
    // - timestamp: current timestamp

    // Return success message with purchase details
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
