import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { buildPortfolioComponents } from "~/utils/portfolio";

export default commandModule({
  type: CommandType.Slash,
  description: "View your portfolio",
  plugins: [databaseUser()],
  options: [
    {
      name: "user",
      description: "The user to view the portfolio of",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  execute: async (ctx) => {
    const user = ctx.options.getUser("user") || ctx.user;
    const { components, attachments } = await buildPortfolioComponents(
      user.id,
      user.displayName,
    );

    await ctx.reply({
      components,
      files: attachments,
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
