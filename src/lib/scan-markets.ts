export const scanSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "LTCUSDT", "BCHUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "TRXUSDT"] as const;
export const scanIntervals = ["15m", "30m", "1h", "4h", "1d"] as const;
export type ScanInterval = (typeof scanIntervals)[number];
export const intervalMilliseconds: Record<ScanInterval, number> = { "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };
