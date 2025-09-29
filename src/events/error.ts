import { eventModule, EventType } from "@sern/handler";
import { Service } from "@sern/handler";

export default eventModule({
  type: EventType.Sern,
  name: "error",
  execute: async (err) => {
    const logger = Service("@sern/logger");
    logger?.error({ message: err });
  },
});
