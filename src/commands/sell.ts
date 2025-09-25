import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { or, ilike } from "drizzle-orm";
import { db } from "~/db/client";
import { assets } from "~/db/schema";
import { databaseUser } from "~/plugins/database-user";
import { cleanCompanyName } from "~/utils/formatting";
import { getPortfolioData } from "~/utils/portfolio";

export default commandModule({
  type: CommandType.Slash,
  description: "Sell assets",
  plugins: [databaseUser()],
  options: [
    {
      name: "asset",
      description: "The asset to sell shares of",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: {
        execute: async (ctx) => {
          const focus = ctx.options.getFocused();
          const ownedAssets = (await getPortfolioData(ctx.user.id)).ownedAssets;

          const asset = ownedAssets
            .filter((asset) =>
              asset.assetId.toLowerCase().includes(focus.toLowerCase())
            )
            .slice(0, 25);

          await ctx.respond(
            asset.map((a) => ({
              name: `${a.assetId}`,
              value: a.assetId,
            }))
          );
        },
      },
    },
    {
      name: "amount",
      description: "The amount of shares to sell",
      type: ApplicationCommandOptionType.Number,
      required: true,
    },
    {
      name: "type",
      description: "The type of transaction",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: "shares",
          value: "shares",
        },
        {
          name: "money",
          value: "money",
        },
      ],
    },
  ],
  execute: async (ctx) => {
    // todo: start working on sell functionality
    // check if the user can sell that much of the asset
    // add a transaction of the user selling the asset
    // update the user's balance

    await ctx.reply(`Selling ${ctx.options.getString("asset", true)}`);
  },
});
