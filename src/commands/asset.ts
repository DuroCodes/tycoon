import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType } from "discord.js";
import { eq, ilike } from "drizzle-orm";
import { db } from "~/db/client";
import { assets } from "~/db/schema";

export default commandModule({
  type: CommandType.Slash,
  description: "View information on a specific stock ticker",
  options: [
    {
      name: "asset",
      description: "The asset to view information on",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
      command: {
        execute: async (ctx) => {
          const focus = ctx.options.getFocused();

          const asset = await db
            .select()
            .from(assets)
            .where(ilike(assets.id, `%${focus}%`))
            .limit(25);

          await ctx.respond(
            asset.map((a) => ({
              name: a.id,
              value: a.id,
            })),
          );
        },
      },
    },
  ],
  execute: async (ctx) => {
    const asset = ctx.options.getString("asset", true);

    const dbAsset = await db.select().from(assets).where(eq(assets.id, asset));

    if (!dbAsset) return ctx.reply("Asset not found");
    await ctx.reply(`Your asset is ${JSON.stringify(dbAsset, null, 2)}`);
  },
});
