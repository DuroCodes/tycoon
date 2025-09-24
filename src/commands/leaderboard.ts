import { commandModule, CommandType } from "@sern/handler";
import {
  ButtonStyle,
  Colors,
  ComponentType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
  UserSelectMenuBuilder,
} from "discord.js";
import { desc } from "drizzle-orm";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { formatMoney } from "~/utils/format-money";

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

    const rankEmojis = {
      0: "🥇",
      1: "🥈",
      2: "🥉",
    } as Record<number, string>;

    const leaderboardContent = leaderboard
      .map(
        (u, i) =>
          // prettier-ignore
          `- ${rankEmojis[i] ?? "🔹"} ${u.user} - **${formatMoney(u.balance)}**`,
      )
      .join("\n");

    const container = new ContainerBuilder({
      accent_color: Colors.Gold,
      components: [
        new TextDisplayBuilder({ content: "### Leaderboard" }).toJSON(),
        new TextDisplayBuilder({ content: leaderboardContent }).toJSON(),
      ],
    });

    await ctx.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
