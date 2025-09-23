import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { db } from "~/db/client";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { databaseUser } from "~/plugins/database-user";

export default commandModule({
  type: CommandType.Slash,
  description: "View your balance",
  plugins: [databaseUser()],
  options: [
    {
      name: "user",
      description: "The user to view the balance of",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  execute: async (ctx) => {
    const user = ctx.options.getUser("user") || ctx.user;

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (existingUser.length === 0)
      await db.insert(users).values({
        id: user.id,
        balance: 0,
      });

    const { balance } = (
      await db
        .select({ balance: users.balance })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
    )[0];

    ctx.reply(`${user.displayName}'s balance: ${balance}`);
  },
});
