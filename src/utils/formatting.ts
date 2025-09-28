export const formatMoney = (money: number) => {
  const formatter = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  return formatter.format(money);
};

export const cleanCompanyName = (name: string) =>
  name
    .replaceAll(
      /\s*(?:,\s*)?(Inc\.?|Corporation|Corp\.?|Ltd\.?|LLC|Company|Co\.?|Incorporated|Holdings)(?=\s|,|$)/gi,
      "",
    )
    .trim();

export const titleCase = (string: string) =>
  string
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatShares = (
  shares: number,
  includeUnit: boolean = true,
): string => {
  const formattedShares = Number.isInteger(shares)
    ? shares.toString()
    : shares.toFixed(4);

  if (!includeUnit) return formattedShares;

  const unit = shares === 1 ? "share" : "shares";
  return `${formattedShares} ${unit}`;
};
