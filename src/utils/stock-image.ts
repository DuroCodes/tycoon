import "chartjs-adapter-date-fns";
import { setTimeout as sleep } from "timers/promises";
import { Chart, registerables } from "chart.js";
import { createCanvas } from "@napi-rs/canvas";
import { COLOR_MAP } from "./components";

Chart.register(...registerables);

const hexToString = (hex: number): string =>
  `#${hex.toString(16).padStart(6, "0")}`;

type ChartDataPoint = {
  value: number;
  timestamp: Date;
};

export const generateValueChartPng = async (
  points: ChartDataPoint[],
  options: {
    width?: number;
    height?: number;
    yAxisFormatter?: (value: number) => string;
    colorUp?: string;
    colorDown?: string;
  } = {},
) => {
  if (points.length < 2) throw new Error("Need at least 2 data points");

  const {
    width = 800,
    height = 300,
    yAxisFormatter = (value) => `$${Number(value).toFixed(2)}`,
    colorUp = hexToString(COLOR_MAP["success"]),
    colorDown = hexToString(COLOR_MAP["error"]),
  } = options;

  const isUp = points[points.length - 1].value >= points[0].value;
  const colors = isUp
    ? {
        border: colorUp,
        fill: `${colorUp}1f`,
      }
    : {
        border: colorDown,
        fill: `${colorDown}1f`,
      };

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const labels = points.map((point) => point.timestamp);
  const data = points.map((point) => point.value);

  const chart = new Chart(ctx as any, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
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
            callback: (value) => yAxisFormatter(Number(value)),
          },
        },
      },
      elements: { point: { radius: 0 } },
    },
  });

  await sleep(100);

  const buffer = canvas.toBuffer("image/png");
  chart.destroy();

  return buffer;
};
