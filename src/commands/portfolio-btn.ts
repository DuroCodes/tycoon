import { commandModule, CommandType } from "@sern/handler";
import { MessageFlags } from "discord.js";
import { buildPortfolioComponents } from "~/utils/portfolio";

export default commandModule({
  type: CommandType.Button,
  name: "portfolio",
  execute: async (ctx, sdt) => {
    const [userId, userDisplayName] = sdt.params!.split("|");

    const { components, attachments } = await buildPortfolioComponents(
      userId,
      userDisplayName,
      ctx.guildId!,
    );

    await ctx.reply({
      components,
      files: attachments,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
});
