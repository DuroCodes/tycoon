import { commandModule, CommandType } from "@sern/handler";
import { MessageFlags } from "discord.js";
import { buildPortfolioComponents } from "~/utils/portfolio";

export default commandModule({
  type: CommandType.Button,
  name: "portfolio",
  execute: async (ctx, sdt) => {
    await ctx.deferReply({ flags: MessageFlags.Ephemeral });
    const [userId, userDisplayName] = sdt.params!.split("|");

    const { components, attachments } = await buildPortfolioComponents(
      userId,
      userDisplayName,
      ctx.guildId!,
    );

    await ctx.editReply({
      components,
      files: attachments,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
});
