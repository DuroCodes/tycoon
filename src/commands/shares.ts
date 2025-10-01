import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { databaseUser } from "~/plugins/database-user";
import { db } from "~/db/client";
import { assets, transactions } from "~/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { container } from "~/utils/components";
import { cleanCompanyName, formatShares } from "~/utils/formatting";
import { getUser, getLatestPrice } from "~/utils/database";
import { assetAutocomplete } from "~/utils/autocomplete";
import { publishConfig } from "@sern/publisher";
import { assignRoles } from "~/utils/assign-roles";

export default commandModule({
  type: CommandType.Slash,
  description: "Admin command to manage user shares",
  plugins: [
    databaseUser(),
    publishConfig({
      defaultMemberPermissions: PermissionFlagsBits.Administrator,
    }),
  ],
  options: [
    {
      name: "set",
      description: "Set a user's shares to a specific amount",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to modify",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "asset",
          description: "The asset to modify",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
          command: assetAutocomplete,
        },
        {
          name: "amount",
          description: "The amount of shares to set",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
    {
      name: "add",
      description: "Add shares to a user",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to add shares to",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "asset",
          description: "The asset to add",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
          command: assetAutocomplete,
        },
        {
          name: "amount",
          description: "The amount of shares to add",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
    {
      name: "remove",
      description:
        "Remove shares from a user",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "The user to remove shares from",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "asset",
          description: "The asset to remove",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
          command: assetAutocomplete,
        },
        {
          name: "amount",
          description: "The amount of shares to remove",
          type: ApplicationCommandOptionType.Number,
          min_value: 0,
          required: true,
        },
      ],
    },
  ],
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const subcommand = ctx.options.getSubcommand();
    const user = ctx.options.getUser("user", true);
    const assetSymbol = ctx.options.getString("asset", true);
    const amount = ctx.options.getNumber("amount", true);

    if (["add", "remove"].includes(subcommand) && amount <= 0)
      return ctx.interaction.editReply({
        components: [container("error", "Amount must be greater than 0.")],
        flags: MessageFlags.IsComponentsV2,
      });

    const assetQuery = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetSymbol))
      .limit(1);

    if (!assetQuery.length)
      return ctx.interaction.editReply({
        components: [container("error", "Asset not found in database")],
        flags: MessageFlags.IsComponentsV2,
      });

    const asset = assetQuery[0];
    const latestPrice = await getLatestPrice(asset.id);

    if (!latestPrice)
      return ctx.interaction.editReply({
        components: [container("error", "Price not found for this asset")],
        flags: MessageFlags.IsComponentsV2,
      });

    const targetUser = await getUser(user.id, ctx.guildId!);

    const latestTransaction = await db
      .select({ sharesAfter: transactions.sharesAfter })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.guildId, ctx.guildId!),
          eq(transactions.assetId, asset.id),
        ),
      )
      .orderBy(desc(transactions.timestamp))
      .limit(1);

    const currentShares = latestTransaction.length
      ? latestTransaction[0].sharesAfter
      : 0;

    const transaction =
      subcommand === "set"
        ? {
            sharesBefore: currentShares,
            sharesAfter: amount,
            sharesToProcess: Math.abs(amount - currentShares),
            transactionType:
              amount > currentShares ? ("buy" as const) : ("sell" as const),
          }
        : subcommand === "add"
          ? {
              sharesBefore: currentShares,
              sharesAfter: currentShares + amount,
              sharesToProcess: amount,
              transactionType: "buy" as const,
            }
          : {
              sharesBefore: currentShares,
              sharesAfter: Math.max(0, currentShares - amount),
              sharesToProcess: Math.min(amount, currentShares),
              transactionType: "sell" as const,
            };

    await db.insert(transactions).values({
      userId: user.id,
      guildId: ctx.guildId!,
      assetId: asset.id,
      type: transaction.transactionType,
      shares: transaction.sharesToProcess,
      pricePerShare: latestPrice.price,
      balanceBefore: targetUser.balance,
      balanceAfter: targetUser.balance,
      sharesBefore: transaction.sharesBefore,
      sharesAfter: transaction.sharesAfter,
    });

    const actionText =
      subcommand === "set"
        ? "Set to"
        : subcommand === "add"
          ? "Added"
          : "Removed";

    const company = cleanCompanyName(asset.name);

    await assignRoles(user.id, ctx.guildId!, ctx.client);

    return ctx.interaction.editReply({
      components: [
        container(
          "success",
          `${actionText} ${formatShares(amount)} of **${asset.id}** (${company}) to ${user}.\n\n-# Current holdings: ${formatShares(transaction.sharesAfter)}`,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
});
