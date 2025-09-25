import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { getUser } from "~/utils/database";

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
    const { balance } = await getUser(user.id);

    await ctx.reply(`${user.displayName}'s balance: ${balance}`);
  },
});
