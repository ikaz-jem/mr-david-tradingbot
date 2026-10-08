export const scanSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "LTCUSDT", "BCHUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "TRXUSDT"] as const;
export const scanIntervals = ["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w"] as const;
export type ScanInterval = (typeof scanIntervals)[number];
export const intervalMilliseconds: Record<ScanInterval, number> = {
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
};
