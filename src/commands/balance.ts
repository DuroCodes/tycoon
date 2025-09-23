import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { createUser } from "~/utils/create-user";

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

    const { balance } = await createUser(user.id);

    ctx.reply(`${user.displayName}'s balance: ${balance}`);
  },
});
