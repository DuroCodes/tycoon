import { commandModule, CommandType } from "@sern/handler";
import {
  APIComponentInContainer,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { container, EMOJI_MAP } from "~/utils/components";
import { formatMoney } from "~/utils/formatting";
import { getTotalWorth } from "~/utils/portfolio";

export default commandModule({
  type: CommandType.Slash,
  description: "View the balance leaderboard",
  plugins: [databaseUser()],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const allUsers = await db
      .select({ user: users.id, balance: users.balance })
      .from(users)
      .where(eq(users.guildId, ctx.guildId!));

    const userWorthPromises = allUsers.map(async (userData) => {
      const fetchedUser = await ctx.guild?.members
        .fetch(userData.user)
        .catch(() => null);

      if (!fetchedUser || fetchedUser.user.bot) return null;

      const totalWorth = await getTotalWorth(userData.user, ctx.guildId!);

      return {
        user: fetchedUser,
        id: userData.user,
        balance: userData.balance,
        totalWorth,
      };
    });

    const usersWithWorth = (await Promise.all(userWorthPromises)).filter(
      Boolean,
    );

    const sortedUsers = usersWithWorth.sort(
      (a, b) => b!.totalWorth - a!.totalWorth,
    );

    const top = sortedUsers.slice(0, 9);

    const leaderboard = top.map((user) => ({
      user: user!.user.displayName,
      id: user!.id,
      balance: user!.balance,
      totalWorth: user!.totalWorth,
    }));

    const currentUserIndex = sortedUsers.findIndex(
      (user) => user!.id === ctx.user.id,
    );
    const currentUserRank = currentUserIndex + 1;
    const currentUserWorth =
      currentUserIndex >= 0 ? sortedUsers[currentUserIndex]!.totalWorth : 0;

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
      const balance = formatMoney(user.totalWorth);

      return new SectionBuilder({
        accessory: new ButtonBuilder({
          label: "Portfolio",
          custom_id: `portfolio/${user.id}|${user.user}`,
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

    const topSections = top
      .map((user, index) => {
        const section = createLeaderboardSection(
          {
            user: user!.user.displayName,
            id: user!.id,
            balance: user!.balance,
            totalWorth: user!.totalWorth,
          },
          index,
        );
        const separator = createSeparator(index, top.length);
        return [section, separator].filter(
          Boolean,
        ) as APIComponentInContainer[];
      })
      .flat();

    await ctx.interaction.editReply({
      components: [
        container(
          "trophy",
          [
            ...topSections,
            new TextDisplayBuilder({
              content: `-# **Your Rank:** #${currentUserRank} (${formatMoney(currentUserWorth)})`,
            }).toJSON(),
          ],
          `### ${EMOJI_MAP.trophy} Leaderboard`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
