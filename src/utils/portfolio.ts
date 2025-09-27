import {
  AttachmentBuilder,
  APIComponentInContainer,
  TextDisplayBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
} from "discord.js";
import { eq, max, and } from "drizzle-orm";
import { db } from "~/db/client";
import { transactions } from "~/db/schema";
import { container, EMOJI_MAP } from "~/utils/components";
import {
  getLatestPrice,
  getUser,
  getUserWorthOverTime,
} from "~/utils/database";
import { formatMoney } from "~/utils/formatting";
import { generateValueChartPng } from "~/utils/stock-image";

const getUserAssetData = async (userId: string, guildId: string) => {
  const latestTimestamps = db
    .select({
      assetId: transactions.assetId,
      maxTimestamp: max(transactions.timestamp).as("maxTimestamp"),
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.guildId, guildId)),
    )
    .groupBy(transactions.assetId)
    .as("latest_timestamps");

  const assetTransactions = await db
    .select({
      assetId: transactions.assetId,
      shares: transactions.sharesAfter,
      pricePerShare: transactions.pricePerShare,
    })
    .from(transactions)
    .innerJoin(
      latestTimestamps,
      and(
        eq(transactions.assetId, latestTimestamps.assetId),
        eq(transactions.timestamp, latestTimestamps.maxTimestamp),
      ),
    )
    .where(
      and(eq(transactions.userId, userId), eq(transactions.guildId, guildId)),
    );

  const latestPrices = await Promise.all(
    assetTransactions.map((t) => getLatestPrice(t.assetId)),
  );

  return assetTransactions.map((t, i) => ({
    ...t,
    price: latestPrices[i]?.price ?? 0,
    worth: (latestPrices[i]?.price ?? 0) * t.shares,
  }));
};

export const getTotalWorth = async (userId: string, guildId: string) => {
  const { balance } = await getUser(userId, guildId);
  const assetData = await getUserAssetData(userId, guildId);
  const ownedAssets = assetData.filter((t) => t.shares > 0);
  const totalWorth = ownedAssets.reduce((acc, t) => acc + t.worth, 0) + balance;
  return totalWorth;
};

export const getPortfolioData = async (userId: string, guildId: string) => {
  const { balance } = await getUser(userId, guildId);
  const assetData = await getUserAssetData(userId, guildId);

  const originalBuyPrices = await Promise.all(
    assetData.map(async (t) => {
      const firstBuy = await db
        .select({ pricePerShare: transactions.pricePerShare })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.guildId, guildId),
            eq(transactions.assetId, t.assetId),
            eq(transactions.type, "buy"),
          ),
        )
        .orderBy(transactions.timestamp)
        .limit(1);

      return firstBuy.length > 0 ? firstBuy[0].pricePerShare : t.pricePerShare;
    }),
  );

  const zipped = assetData
    .map((t, i) => ({
      ...t,
      difference: t.price - originalBuyPrices[i],
    }))
    .sort((a, b) => b.worth - a.worth);

  const ownedAssets = zipped.filter((t) => t.shares > 0);
  const totalWorth = await getTotalWorth(userId, guildId);

  let portfolioContent = "";

  if (ownedAssets.length > 0) {
    portfolioContent += `### Assets\n`;
    ownedAssets.forEach((t) => {
      const priceChange =
        t.difference > 0
          ? `+${formatMoney(t.difference)}`
          : t.difference < 0
            ? `${formatMoney(t.difference)}`
            : null;

      const changeEmoji =
        t.difference > 0
          ? EMOJI_MAP.gain
          : t.difference < 0
            ? EMOJI_MAP.loss
            : EMOJI_MAP.neutral;

      const shares = t.shares.toFixed(4);
      const worth = formatMoney(t.worth);
      const shareForm = t.shares === 1 ? "share" : "shares";
      const shareText = Number.isInteger(t.shares)
        ? `${t.shares} ${shareForm}`
        : `${shares} ${shareForm}`;
      const priceStr = priceChange ? ` (${priceChange})` : "";

      portfolioContent += `- ${changeEmoji} **${t.assetId}** • ${worth}${priceStr} • ${shareText}\n`;
    });
  }

  portfolioContent += `-# Total Worth: **${formatMoney(totalWorth)}**`;

  let worthChartBuffer: Buffer | null = null;
  try {
    const worthData = await getUserWorthOverTime(userId, guildId);
    if (worthData.length > 1)
      worthChartBuffer = await generateValueChartPng(worthData, {
        yAxisFormatter: (value) => formatMoney(value),
      });
  } catch (error) {
    console.error("Failed to generate worth chart:", error);
  }

  return {
    balance,
    totalWorth,
    ownedAssets,
    portfolioContent,
    worthChartBuffer,
  };
};

export const buildPortfolioComponents = async (
  userId: string,
  userDisplayName: string,
  guildId: string,
) => {
  const portfolioData = await getPortfolioData(userId, guildId);
  const attachments: AttachmentBuilder[] = [];

  if (portfolioData.worthChartBuffer) {
    const chartAttachment = new AttachmentBuilder(
      portfolioData.worthChartBuffer,
      {
        name: "worth-chart.png",
      },
    );
    attachments.push(chartAttachment);
  }

  const components = [
    new TextDisplayBuilder({
      content: `Balance: **${formatMoney(portfolioData.balance)}**`,
    }).toJSON(),

    portfolioData.worthChartBuffer
      ? new MediaGalleryBuilder({
          items: [
            new ThumbnailBuilder({
              media: { url: "attachment://worth-chart.png" },
            }).toJSON(),
          ],
        }).toJSON()
      : null,

    new TextDisplayBuilder({
      content: portfolioData.portfolioContent,
    }).toJSON(),
  ].filter(Boolean) as APIComponentInContainer[];

  return {
    components: [
      container(
        "person",
        components,
        `### ${EMOJI_MAP.person} ${userDisplayName}'s Portfolio`,
      ),
    ],
    attachments,
  };
};
