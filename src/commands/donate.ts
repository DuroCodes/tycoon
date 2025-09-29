import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  GuildMember,
  MessageFlags,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { container } from "~/utils/components";
import { getUser } from "~/utils/database";
import { formatMoney } from "~/utils/formatting";

export default commandModule({
  type: CommandType.Slash,
  description: "Donate to another user's portfolio",
  plugins: [databaseUser()],
  options: [
    {
      name: "user",
      description: "The user to donate to",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "amount",
      description: "The amount to donate",
      type: ApplicationCommandOptionType.Number,
      required: true,
      min_value: 0,
    },
  ],
  execute: async (ctx) => {
    const user = ctx.options.getMember("user") || ctx.member;
    if (!user || !(user instanceof GuildMember)) return;

    const amount = ctx.options.getNumber("amount", true);
    if (amount == 0) {
      return ctx.reply({
        components: [container("error", "You cannot donate no money.")],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const sender = await getUser(ctx.user.id, ctx.guildId!);
    const reciever = await getUser(user.id, ctx.guildId!);

    if (amount > sender.balance) {
      return ctx.reply({
        components: [
          container("error", "You cannot donate more money than you have."),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    await db
      .update(users)
      .set({ balance: sender.balance - amount })
      .where(and(eq(users.id, sender.id), eq(users.guildId, ctx.guildId!)));

    await db
      .update(users)
      .set({ balance: reciever.balance + amount })
      .where(and(eq(users.id, reciever.id), eq(users.guildId, ctx.guildId!)));

    ctx.reply({
      components: [
        container(
          "success",
          `You have donated ${formatMoney(amount)} to ${user.displayName}.`
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
