import { CommandControlPlugin, controller } from "@sern/handler";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/client";

export const databaseUser = () =>
  CommandControlPlugin(async (ctx, sdt) => {
    try {
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (existingUser.length === 0) {
        await db.insert(users).values({
          id: ctx.user.id,
        });

        sdt.deps["@sern/logger"]?.info({
          message: `Created new user in database: ${ctx.user.id}`,
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
