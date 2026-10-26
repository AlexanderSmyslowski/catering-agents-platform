export function formatQuantityNumber(value: number): string {
  return value.toLocaleString("de-DE", { useGrouping: false, maximumSignificantDigits: 15 });
}

export function formatKitchenQuantity(amount: number, unit: string): string {
  return unit === "kg" && amount > 0 && amount < 1
    ? `${formatQuantityNumber(Number((amount * 1000).toPrecision(15)))} g`
    : `${formatQuantityNumber(amount)} ${unit}`;
}
