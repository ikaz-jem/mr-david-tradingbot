export function commissionMinor(amount: number, basisPoints: number) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error("Invalid commission calculation");
  return Number(BigInt(amount) * BigInt(basisPoints) / BigInt(10000));
}
export function validAffiliateRates(rates: number[]) {
  return rates.length >= 1 && rates.length <= 5 && rates.every(rate => Number.isInteger(rate) && rate >= 0 && rate <= 10000) && rates.reduce((sum, rate) => sum + rate, 0) <= 10000;
}
