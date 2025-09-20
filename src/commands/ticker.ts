import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { tickers } from "~/utils/tickers";

export default commandModule({
  type: CommandType.Slash,
  description: "View information on a specific stock ticker",
  options: [
    {
      name: "ticker",
      description: "The ticker to view information on",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: {
        execute: (ctx) => {
          const focus = ctx.options.getFocused();

          const filteredTickers = tickers
            .filter((t) => t.toLowerCase().startsWith(focus.toLowerCase()))
            .slice(0, 25)
            .map((t) => ({
              name: t,
              value: t,
            }));

          ctx.respond(filteredTickers);
        },
      },
    },
  ],
  execute: async (ctx, sdt) => {
    const ticker = ctx.options.get("ticker", true);
    await ctx.reply(`Your ticker is ${ticker}`);
  },
});
