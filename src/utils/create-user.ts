import { db } from "~/db/client";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export const createUser = async (userId: string) => {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length) return existingUser[0];

  const newUser = await db.insert(users).values({ id: userId }).returning();
  return newUser[0];
};
