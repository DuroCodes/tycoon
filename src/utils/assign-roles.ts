import { Client } from "discord.js";
import { getAllRoleConfigs } from "./database";
import { getTotalWorth } from "./portfolio";

export const assignAllRoles = async (guildId: string, client: Client) => {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();

  for (const [, member] of members) {
    await assignRoles(member.id, guildId, client);
  }
};

export const assignRoles = async (
  userId: string,
  guildId: string,
  client: Client,
) => {
  if (userId === client.user?.id) return;

  try {
    const userValue = await getTotalWorth(userId, guildId);
    const roleConfigs = await getAllRoleConfigs(guildId);

    const topRole = roleConfigs.find((c) => userValue >= c.threshold);

    const rolesToRemove = roleConfigs.filter((c) => c !== topRole);
    const rolesToRemoveIds = rolesToRemove.map((config) => config.roleId);

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    if (topRole) await member.roles.add(topRole.roleId);
    await member.roles.remove(rolesToRemoveIds);
  } catch (error) {
    console.error(error);
  }
};
