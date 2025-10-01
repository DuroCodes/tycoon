import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  GuildMember,
  MessageFlags,
} from "discord.js";
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
    {
      name: "period",
      description: "Time period for the portfolio chart",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "1 Day", value: "1d" },
        { name: "7 Days", value: "7d" },
        { name: "30 Days", value: "30d" },
        { name: "90 Days", value: "90d" },
        { name: "1 Year", value: "1y" },
      ],
    },
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const user = ctx.options.getMember("user") || ctx.member;
    const period = ctx.options.getString("period") || "7d";

    if (!user || !(user instanceof GuildMember)) return;

    const { components, attachments } = await buildPortfolioComponents(
      user.id,
      user.displayName,
      ctx.guildId!,
      period,
    );

    await ctx.interaction.editReply({
      components,
      files: attachments,
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
