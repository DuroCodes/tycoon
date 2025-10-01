import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { container } from "~/utils/components";
import { formatMoney } from "~/utils/formatting";
import { getUser } from "~/utils/database";
import { publishConfig } from "@sern/publisher";
import { assignRoles } from "~/utils/assign-roles";

export default commandModule({
  type: CommandType.Slash,
  description: "Admin command to add (or remove) balance from a user",
  plugins: [
    databaseUser(),
    publishConfig({
      defaultMemberPermissions: PermissionFlagsBits.Administrator,
    }),
  ],
  options: [
    {
      name: "set",
      description: "Set a user's balance to a specific amount",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to modify",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "The amount of balance to adjust the user to",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
    {
      name: "add",
      description: "Add balance to a user",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to add balance to",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "The amount of money to add",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
    {
      name: "remove",
      description: "Remove balance from a user",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to remove balance from",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "The amount of money to remove",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const subcommand = ctx.options.getSubcommand();
    const user = ctx.options.getUser("user", true);
    const amount = ctx.options.getNumber("amount", true);

    if (["add", "remove"].includes(subcommand) && amount <= 0)
      return ctx.interaction.editReply({
        components: [container("error", "Amount must be greater than 0.")],
        flags: MessageFlags.IsComponentsV2,
      });

    const { balance: currentBalance } = await getUser(user.id, ctx.guildId!);
    const newBalance =
      subcommand === "set"
        ? amount
        : subcommand === "add"
          ? currentBalance + amount
          : currentBalance - amount;

    await db
      .update(users)
      .set({ balance: newBalance })
      .where(and(eq(users.id, user.id), eq(users.guildId, ctx.guildId!)));

    await assignRoles(user.id, ctx.guildId!, ctx.client);

    ctx.interaction.editReply({
      components: [
        container(
          "success",
          `Updated ${user}'s balance to ${formatMoney(newBalance)}.`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
