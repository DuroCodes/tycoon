import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";

export default commandModule({
  type: CommandType.Slash,
  description: "View your balance",
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
    // todo: get balance from db
    const balance = 0;

    ctx.reply(`${user.displayName}'s balance: ${balance}`);
  },
});
