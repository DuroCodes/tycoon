import z from "zod";
import { setTimeout as sleep } from "timers/promises";
import { Err, Ok } from "./result";

export const zodFetch = async <TSchema extends z.Schema>(
  schema: TSchema,
  error: string,
  ...args: Parameters<typeof fetch>
) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(...args);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("HTTP error:", errorText);

        if (attempt === 3)
          return Err(`${error}: HTTP ${res.status}: ${errorText}`);

        await sleep(Math.pow(2, attempt - 1) * 1000);
        continue;
      }

      const json = (await res.json()) as unknown;
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        console.error(
          "Validation failed:",
          parsed.error.issues.map((i) => `${i.code} | ${i.message}`).join("\n"),
        );

        if (attempt === 3) return Err(`${error}: Schema validation failed`);

        await sleep(Math.pow(2, attempt - 1) * 1000);
        continue;
      }

      return Ok(json as z.infer<TSchema>);
    } catch (err) {
      console.error(`Attempt ${attempt}/3 failed:`, err);

      if (attempt === 3)
        return Err(
          `${error}: ${err instanceof Error ? err.message : String(err)}`,
        );

      await sleep(Math.pow(2, attempt - 1) * 1000);
    }
  }

  return Err(error);
};
