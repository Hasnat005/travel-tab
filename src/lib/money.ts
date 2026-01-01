export type FormatTakaOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatTaka(amount: number, options: FormatTakaOptions = {}) {
  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;

  try {
    const formattedAbs = new Intl.NumberFormat(undefined, {
      style: "decimal",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(Math.abs(amount));

    const sign = amount < 0 ? "-" : "";
    return `${sign}Tk ${formattedAbs}`;
  } catch {
    const sign = amount < 0 ? "-" : "";
    return `${sign}Tk ${Math.abs(amount).toFixed(maximumFractionDigits)}`;
  }
}
