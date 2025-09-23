import { CommandControlPlugin, controller } from "@sern/handler";
import { createUser } from "~/utils/create-user";

export const databaseUser = () =>
  CommandControlPlugin(async (ctx, sdt) => {
    try {
      await createUser(ctx.user.id);
      return controller.next();
    } catch (error) {
      sdt.deps["@sern/logger"]?.error({
        message: `Database user plugin error: ${error}`,
      });

      return controller.stop("Database error occurred");
    }
  });
