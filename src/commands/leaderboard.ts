import { commandModule, CommandType } from "@sern/handler";
import {
  APIComponentInContainer,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { desc } from "drizzle-orm";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { container, EMOJI_MAP } from "~/utils/components";
import { formatMoney } from "~/utils/formatting";

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
        ? {
            user: fetchedUser,
            id: userBalance.user,
            balance: userBalance.balance,
          }
        : null;
    });

    const fetchedUsers = (await Promise.all(userFetchPromises)).filter(Boolean);

    const leaderboard = fetchedUsers.map((user) => ({
      user: user!.user.displayName,
      id: user!.id,
      balance: user!.balance,
    }));

    const rankEmojis = {
      0: "🥇",
      1: "🥈",
      2: "🥉",
    } as Record<number, string>;

    const createLeaderboardSection = (
      user: (typeof leaderboard)[number],
      index: number,
    ) => {
      const rankEmoji = rankEmojis[index] ?? "🔹";
      const balance = formatMoney(user.balance);

      return new SectionBuilder({
        accessory: new ButtonBuilder({
          label: "Holdings",
          custom_id: `holdings/${user.id}`,
          style: ButtonStyle.Secondary,
        }).toJSON(),
        components: [
          new TextDisplayBuilder({
            content: `${rankEmoji} ${user.user} - **${balance}**`,
          }).toJSON(),
        ],
      }).toJSON();
    };

    const createSeparator = (index: number, totalLength: number) =>
      index !== totalLength - 1 ? new SeparatorBuilder().toJSON() : null;

    const leaderboardSections = leaderboard.flatMap((user, index) => {
      const section = createLeaderboardSection(user, index);
      const separator = createSeparator(index, leaderboard.length);

      return [section, separator].filter(Boolean) as APIComponentInContainer[];
    });

    await ctx.reply({
      components: [
        container(
          "trophy",
          leaderboardSections,
          `### ${EMOJI_MAP.trophy} Leaderboard`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
