import z from "zod";
import { Err, Ok } from "./result";

export const zodFetch = async <TSchema extends z.Schema>(
  schema: TSchema,
  error: string,
  ...args: Parameters<typeof fetch>
) => {
  const res = await fetch(...args);

  if (!res.ok) {
    console.error(await res.text());
    return Err(error);
  }

  const json = (await res.json()) as unknown;
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    console.error(
      parsed.error.issues.map((i) => `${i.code} | ${i.message}`).join("\n"),
    );
    return Err(error);
  }

  return Ok(json as z.infer<TSchema>);
};
