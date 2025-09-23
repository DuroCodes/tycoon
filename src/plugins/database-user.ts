import { CommandControlPlugin, controller } from "@sern/handler";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/client";

export const databaseUser = () => {
  return CommandControlPlugin(async (ctx, sdt) => {
    try {
      const userId = ctx.user.id;

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        await db.insert(users).values({
          id: userId,
          balance: 0,
        });

        sdt.deps["@sern/logger"]?.info({
          message: `Created new user in database: ${userId}`,
        });
      }

      return controller.next();
    } catch (error) {
      sdt.deps["@sern/logger"]?.error({
        message: `Database user plugin error: ${error}`,
      });

      return controller.stop("Database error occurred");
    }
  });
};
