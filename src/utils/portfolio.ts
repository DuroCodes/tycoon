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
  getUserBalanceOverTime,
} from "~/utils/database";
import { formatMoney } from "~/utils/formatting";
import { generateValueChartPng } from "~/utils/stock-image";

export const getPortfolioData = async (userId: string) => {
  const { balance } = await getUser(userId);

  const latestTimestamps = db
    .select({
      assetId: transactions.assetId,
      maxTimestamp: max(transactions.timestamp).as("maxTimestamp"),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
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
    .where(eq(transactions.userId, userId));

  const originalBuyPrices = await Promise.all(
    assetTransactions.map(async (t) => {
      const firstBuy = await db
        .select({ pricePerShare: transactions.pricePerShare })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.assetId, t.assetId),
            eq(transactions.type, "buy"),
          ),
        )
        .orderBy(transactions.timestamp)
        .limit(1);

      return firstBuy.length > 0 ? firstBuy[0].pricePerShare : t.pricePerShare;
    }),
  );

  const latestPrices = await Promise.all(
    assetTransactions.map((t) => getLatestPrice(t.assetId)),
  );

  const zipped = assetTransactions
    .map((t, i) => ({
      ...t,
      price: latestPrices[i]?.price ?? 0,
      worth: (latestPrices[i]?.price ?? 0) * t.shares,
      difference: (latestPrices[i]?.price ?? 0) - originalBuyPrices[i],
    }))
    .sort((a, b) => b.worth - a.worth);

  const ownedAssets = zipped.filter((t) => t.shares > 0);
  const totalWorth = ownedAssets.reduce((acc, t) => acc + t.worth, 0) + balance;

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

  let balanceChartBuffer: Buffer | null = null;
  try {
    const balanceData = await getUserBalanceOverTime(userId);
    if (balanceData.length > 1)
      balanceChartBuffer = await generateValueChartPng(balanceData, {
        yAxisFormatter: (value) => formatMoney(value),
      });
  } catch (error) {
    console.error("Failed to generate balance chart:", error);
  }

  return {
    balance,
    totalWorth,
    ownedAssets,
    portfolioContent,
    balanceChartBuffer,
  };
};

export const buildPortfolioComponents = async (
  userId: string,
  userDisplayName: string,
) => {
  const portfolioData = await getPortfolioData(userId);
  const attachments: AttachmentBuilder[] = [];

  if (portfolioData.balanceChartBuffer) {
    const chartAttachment = new AttachmentBuilder(
      portfolioData.balanceChartBuffer,
      {
        name: "balance-chart.png",
      },
    );
    attachments.push(chartAttachment);
  }

  const components = [
    new TextDisplayBuilder({
      content: `Balance: **${formatMoney(portfolioData.balance)}**`,
    }).toJSON(),
    
    portfolioData.balanceChartBuffer
      ? new MediaGalleryBuilder({
          items: [
            new ThumbnailBuilder({
              media: { url: "attachment://balance-chart.png" },
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
