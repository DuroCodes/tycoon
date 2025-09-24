import "chartjs-adapter-date-fns";
import { Chart, registerables } from "chart.js";
import { createCanvas } from "@napi-rs/canvas";
import { prices } from "~/db/schema";
import { COLOR_MAP } from "./components";

Chart.register(...registerables);

const hexToString = (hex: number): string =>
  `#${hex.toString(16).padStart(6, "0")}`;

type PricePoint = Pick<typeof prices.$inferSelect, "price" | "timestamp">;

export const generateStockChartPng = async (
  symbol: string,
  points: PricePoint[],
  width = 800,
  height = 300,
) => {
  if (points.length < 2) throw new Error("Need at least 2 data points");

  const isUp = points[points.length - 1].price >= points[0].price;
  const colors = isUp
    ? {
        border: hexToString(COLOR_MAP["success"]),
        fill: `${hexToString(COLOR_MAP["success"])}1f`,
      }
    : {
        border: hexToString(COLOR_MAP["error"]),
        fill: `${hexToString(COLOR_MAP["error"])}1f`,
      };

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const labels = points.map((point) => point.timestamp);
  const data = points.map((point) => point.price);

  const chart = new Chart(ctx as any, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: symbol,
          data: data,
          borderColor: colors.border,
          backgroundColor: colors.fill,
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          type: "time",
          time: { displayFormats: { day: "MM/dd" } },
          grid: { color: "rgba(255,255,255,0.08)", lineWidth: 1 },
          ticks: {
            color: "rgba(255,255,255,0.7)",
            font: { size: 12 },
            maxTicksLimit: 6,
          },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.08)", lineWidth: 1 },
          ticks: {
            color: "rgba(255,255,255,0.7)",
            font: { size: 12 },
            callback: (value) => `$${Number(value).toFixed(2)}`,
          },
        },
      },
      elements: { point: { radius: 0 } },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const buffer = canvas.toBuffer("image/png");
  chart.destroy();

  return buffer;
};

// // Generate the chart
// const aaplData = loadStockDataFromCSV("SO");
// console.log(`Loaded ${aaplData.length} SO data points`);

// generateStockChartPng("SO", aaplData, 1200, 600).then((buffer) => {
//   writeFileSync("stock-chartjs-so.png", buffer);
//   console.log("Chart saved as stock-chartjs-so.png");
// });
