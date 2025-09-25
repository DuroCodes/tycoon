import {
  APIComponentInContainer,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { titleCase } from "./formatting";

export const COLOR_MAP = {
  success: 0x8aeb91,
  error: 0xe84243,
  info: 0xdedfe1,
  person: 0xdedfe1,
  trophy: 0xf1c40f,
} as const;

export const EMOJI_MAP = {
  success: "<:success:1420543871074566235>",
  error: "<:error:1420543861884719255>",
  loss: "<:loss:1420409806761492490>",
  gain: "<:gain:1420409793423741130>",
  info: "<:info:1420604922658947112>",
  person: "<:person:1420604897228754954>",
  trophy: "<:trophy:1420609170897502218>",
  neutral: "<:neutral:1420619776807403530>",
} as const;

type ContainerVariant = keyof typeof COLOR_MAP;

export const container = (
  variant: ContainerVariant,
  content: string | APIComponentInContainer[],
  title = `### ${EMOJI_MAP[variant]} ${titleCase(variant)}`,
  color = COLOR_MAP[variant],
) => {
  const components = Array.isArray(content)
    ? content
    : [new TextDisplayBuilder({ content }).toJSON()];

  return new ContainerBuilder({
    accent_color: color,
    components: [
      new TextDisplayBuilder({ content: title }).toJSON(),
      ...components,
    ],
  });
};
