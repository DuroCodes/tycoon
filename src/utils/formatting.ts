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
