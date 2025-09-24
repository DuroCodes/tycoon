import { commandModule, CommandType } from "@sern/handler";
import { desc } from "drizzle-orm";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";

export default commandModule({
  type: CommandType.Slash,
  description: "View the balance leaderboard",
  plugins: [databaseUser()],
  execute: async (ctx) => {
    const userBalances = await db
      .select({ user: users.id, balance: users.balance })
      .from(users)
      .orderBy(desc(users.balance));

    const userFetchPromises = userBalances.map(async (userBalance) => {
      const fetchedUser = await ctx.client.users
        .fetch(userBalance.user)
        .catch(() => null);

      return fetchedUser
        ? { user: fetchedUser, balance: userBalance.balance }
        : null;
    });

    const fetchedUsers = (await Promise.all(userFetchPromises)).filter(Boolean);

    const leaderboard = fetchedUsers.map((user) => ({
      user: user!.user.displayName,
      balance: user!.balance,
    }));

    await ctx.reply(JSON.stringify(leaderboard, null, 2));
  },
});
