import { commandModule, CommandType } from "@sern/handler";

export default commandModule({
  type: CommandType.Slash,
  description: "A ping command",
  execute: async (ctx, args) => {
    await ctx.reply("Pong 🏓");
  },
});
