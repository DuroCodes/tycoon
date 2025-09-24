export const formatMoney = (money: number) => {
  const formatter = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  return formatter.format(money);
};

export const cleanCompanyName = (name: string) =>
  name
    .replace(
      /\s*(?:,\s*)?(Inc\.?|Corporation|Corp\.?|Ltd\.?|LLC|Company|Co\.?|Incorporated|Holdings)$/i,
      "",
    )
    .trim();

export const titleCase = (string: string) =>
  string
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
