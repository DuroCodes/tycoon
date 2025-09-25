import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { eq, desc, max, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db/client";
import { transactions } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { getUser } from "~/utils/database";

export default commandModule({
  type: CommandType.Slash,
  description: "View your portfolio",
  plugins: [databaseUser()],
  options: [
    {
      name: "user",
      description: "The user to view the portfolio of",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  execute: async (ctx) => {
    const user = ctx.options.getUser("user") || ctx.user;
    const { balance } = await getUser(user.id);

    // Get the most recent transaction for each asset that the user owns
    // Using a more intuitive approach with a subquery
    const latestTimestamps = db
      .select({
        assetId: transactions.assetId,
        maxTimestamp: max(transactions.timestamp).as("maxTimestamp"),
      })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .groupBy(transactions.assetId)
      .as("latest_timestamps");

    const assetTransactions = await db
      .select({
        assetId: transactions.assetId,
        shares: transactions.sharesAfter,
      })
      .from(transactions)
      .innerJoin(
        latestTimestamps,
        and(
          eq(transactions.assetId, latestTimestamps.assetId),
          eq(transactions.timestamp, latestTimestamps.maxTimestamp),
        ),
      )
      .where(eq(transactions.userId, user.id));

    await ctx.reply(`${user.displayName}'s balance: ${balance}`);
  },
});
