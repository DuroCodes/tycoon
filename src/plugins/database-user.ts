import { CommandControlPlugin, controller } from "@sern/handler";
import { getUser } from "~/utils/database";

export const databaseUser = () =>
  CommandControlPlugin(async (ctx, sdt) => {
    try {
      if (!ctx.guildId)
        return controller.stop("This command can only be used in a server");
      await getUser(ctx.user.id, ctx.guildId);
      return controller.next();
    } catch (error) {
      sdt.deps["@sern/logger"]?.error({
        message: `Database user plugin error: ${error}`,
      });

      return controller.stop("Database error occurred");
    }
  });
