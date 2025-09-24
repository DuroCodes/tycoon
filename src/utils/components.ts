import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { titleCase } from "./formatting";

type ContainerVariant = "success" | "error";

export const COLOR_MAP = {
  success: 0x69b473,
  error: 0xe84243,
} as const;

export const EMOJI_MAP = {
  success: "<:success:1420543871074566235>",
  error: "<:error:1420543861884719255>",
  loss: "<:loss:1420409806761492490>",
  gain: "<:gain:1420409793423741130>",
} as const;

export const container = (variant: ContainerVariant, content: string) =>
  new ContainerBuilder({
    accent_color: COLOR_MAP[variant],
    components: [
      new TextDisplayBuilder({
        content: `### ${EMOJI_MAP[variant]} ${titleCase(variant)}`,
      }).toJSON(),
      new TextDisplayBuilder({ content }).toJSON(),
    ],
  });
