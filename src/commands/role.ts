import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { db } from "~/db/client";
import { roleConfig } from "~/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { container, EMOJI_MAP } from "~/utils/components";
import { formatMoney } from "~/utils/formatting";
import { getAllRoleConfigs, getRoleConfig } from "~/utils/database";
import { publishConfig } from "@sern/publisher";

export default commandModule({
  type: CommandType.Slash,
  description: "Manage role configurations for money thresholds",
  plugins: [
    databaseUser(),
    publishConfig({
      defaultMemberPermissions: PermissionFlagsBits.Administrator,
    }),
  ],
  options: [
    {
      name: "create",
      description: "Create or update a role configuration",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "The role to configure",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
        {
          name: "threshold",
          description: "Money threshold required for this role",
          type: ApplicationCommandOptionType.Number,
          required: true,
        },
      ],
    },
    {
      name: "list",
      description: "List all configured roles and their money thresholds",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "delete",
      description: "Delete a role configuration",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "The role configuration to delete",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
  ],
  execute: async (ctx) => {
    const subcommand = ctx.options.getSubcommand();

    switch (subcommand) {
      case "create": {
        const role = ctx.options.getRole("role", true);
        const threshold = ctx.options.getNumber("threshold", true);

        if (
          role.position >=
          (ctx.interaction.guild?.members.me?.roles.highest.position ?? 0)
        ) {
          return ctx.reply({
            components: [
              container("error", `Please set my role higher than ${role}.`),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (threshold <= 0)
          return ctx.reply({
            components: [
              container("error", "Threshold must be greater than 0."),
            ],
            flags: MessageFlags.IsComponentsV2,
          });

        const conflictingConfig = await db
          .select()
          .from(roleConfig)
          .where(
            and(
              eq(roleConfig.guildId, ctx.guildId!),
              eq(roleConfig.threshold, threshold),
              ne(roleConfig.roleId, role.id),
            ),
          )
          .limit(1);

        if (conflictingConfig.length)
          return ctx.reply({
            components: [
              container(
                "error",
                `Threshold ${formatMoney(threshold)} is already used by <@&${conflictingConfig[0].roleId}>. Please choose a different threshold.`,
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
          });

        const existingConfig = await getRoleConfig(ctx.guildId!, role.id);

        if (existingConfig) {
          await db
            .update(roleConfig)
            .set({
              threshold,
            })
            .where(
              and(
                eq(roleConfig.guildId, ctx.guildId!),
                eq(roleConfig.roleId, role.id),
              ),
            );

          return ctx.reply({
            components: [
              container(
                "success",
                `Successfully updated configuration for role ${role}.`,
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await db.insert(roleConfig).values({
          guildId: ctx.guildId!,
          roleId: role.id,
          threshold,
        });

        return ctx.reply({
          components: [
            container(
              "success",
              `Successfully created configuration for role ${role}.`,
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      case "list": {
        const roleConfigs = await getAllRoleConfigs(ctx.guildId!);

        if (!roleConfigs.length)
          return ctx.reply({
            components: [
              container(
                "error",
                `No role configurations found. Use </role create:${ctx.interaction.commandId}> to create one.`,
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
          });

        const roleList = roleConfigs
          .map(
            (c, i) =>
              `${i + 1}. <@&${c.roleId}> (≥${formatMoney(c.threshold)})`,
          )
          .join("\n");

        return ctx.reply({
          components: [
            container(
              "info",
              roleList,
              `### ${EMOJI_MAP.info} Role Configurations`,
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      case "delete": {
        const role = ctx.options.getRole("role", true);
        const existingConfig = await getRoleConfig(ctx.guildId!, role.id);

        if (!existingConfig) {
          return ctx.reply({
            components: [
              container("error", `No configuration found for ${role}.`),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await db
          .delete(roleConfig)
          .where(
            and(
              eq(roleConfig.guildId, ctx.guildId!),
              eq(roleConfig.roleId, role.id),
            ),
          );

        return ctx.reply({
          components: [
            container(
              "success",
              `Successfully deleted configuration for ${role}.`,
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
  },
});
