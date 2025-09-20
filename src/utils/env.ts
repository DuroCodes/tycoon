import { z } from "zod";

export const envSchema = z.object({
  DISCORD_TOKEN: z.string(),
  ALPHA_VANTAGE_API_KEY: z.string(),
});

export const env = envSchema.parse(process.env);
