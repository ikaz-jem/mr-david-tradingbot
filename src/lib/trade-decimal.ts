const SCALE = 10n ** 12n;
export function decimalUnits(value: string | number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{0,12}))?$/.exec(String(value).trim());
  if (!match) throw new Error("Invalid exchange decimal value.");
  return (match[1] ? -1n : 1n) * (BigInt(match[2]) * SCALE + BigInt((match[3] ?? "").padEnd(12, "0")));
}
export function decimalText(units: bigint): string {
  const negative = units < 0n, absolute = negative ? -units : units;
  const fraction = String(absolute % SCALE).padStart(12, "0").replace(/0+$/, "");
  return (negative ? "-" : "") + String(absolute / SCALE) + (fraction ? "." + fraction : "");
}
export function decimalAdd(values: Array<string | number>): string {
  return decimalText(values.reduce<bigint>((sum, value) => sum + decimalUnits(value), 0n));
}
export function decimalMultiply(a: string | number, b: string | number): string {
  return decimalText(decimalUnits(a) * decimalUnits(b) / SCALE);
}
