import { scheduledTask } from "@sern/handler";
import { assignAllRoles } from "~/utils/assign-roles";
import { computeAssetPrices } from "~/utils/compute-prices";

export default scheduledTask({
  // Run every 30 minutes during market hours (9:30 AM - 4:00 PM EST, Monday-Friday)
  // 00,30 9-16 * * 1-5 means: at 00, 30 minutes past the hour,
  // from 9 AM to 4 PM, Monday through Friday
  trigger: "00,30 9-16 * * 1-5",
  timezone: "America/New_York",
  execute: async (_ctx, sdt) => {
    await computeAssetPrices(sdt);

    const guilds = await sdt.deps["@sern/client"].guilds.fetch();
    for (const [, guild] of guilds) {
      await assignAllRoles(guild.id, sdt.deps["@sern/client"]);
    }
  },
});
