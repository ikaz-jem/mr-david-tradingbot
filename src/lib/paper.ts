export const PAPER_METHOD = "paper-1m-v1";
export const PAPER_FEE_RATE = 0.001;
export const PAPER_SLIPPAGE_RATE = 0.0005;
const MINUTE = 60_000;

export type PaperCandle = { openTime: number; closeTime: number; open: number; high: number; low: number; close: number };
export type PaperSignal = { entry: number; stop: number; target: number; createdAt: Date; expiresAt: Date };
export type PaperResult = {
  status: "waiting" | "open" | "closed" | "expired";
  reason: "none" | "stop" | "target" | "time_exit" | "no_entry";
  entryAt: Date | null;
  exitAt: Date | null;
  exitPrice: number | null;
  netReturnPct: number | null;
};

export function paperStartTime(publishedAt: Date) { return Math.ceil(publishedAt.getTime() / MINUTE) * MINUTE; }

export function evaluatePaperSignal(signal: PaperSignal, candles: PaperCandle[], asOf = new Date()): PaperResult {
  if (!(signal.entry > 0 && signal.stop > 0 && signal.stop < signal.entry && signal.target > signal.entry)) throw new Error("Invalid paper signal levels");
  const start = paperStartTime(signal.createdAt);
  const end = Math.min(signal.expiresAt.getTime(), asOf.getTime());
  const eligible = candles.filter(row => row.openTime >= start && row.closeTime < end && row.closeTime < asOf.getTime());
  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i];
    if (![row.openTime, row.closeTime, row.open, row.high, row.low, row.close].every(Number.isFinite) || row.low <= 0 || row.high < row.low || row.open < row.low || row.open > row.high || row.close < row.low || row.close > row.high || (i > 0 && row.openTime - eligible[i - 1].openTime !== MINUTE)) throw new Error("Incomplete paper market data");
  }
  if (eligible.length && eligible[0].openTime !== start) throw new Error("Paper market history does not start after publication");
  const finished = asOf.getTime() >= signal.expiresAt.getTime();
  if (finished && start < signal.expiresAt.getTime()) {
    const finalOpen = Math.floor(signal.expiresAt.getTime() / MINUTE) * MINUTE - MINUTE;
    if (!eligible.length || eligible[0].openTime !== start || eligible.at(-1)!.openTime < finalOpen) throw new Error("Paper market history has gaps");
  }
  let entryAt: Date | null = null;
  const result = (status: PaperResult["status"], reason: PaperResult["reason"], exit: PaperCandle | null = null, exitPrice: number | null = null): PaperResult => {
    const buy = signal.entry * (1 + PAPER_SLIPPAGE_RATE) * (1 + PAPER_FEE_RATE);
    const sell = exitPrice === null ? null : exitPrice * (1 - PAPER_SLIPPAGE_RATE) * (1 - PAPER_FEE_RATE);
    return { status, reason, entryAt, exitAt: exit ? new Date(exit.closeTime) : null, exitPrice, netReturnPct: sell === null ? null : Number(((sell / buy - 1) * 100).toFixed(4)) };
  };
  for (const row of eligible) {
    if (!entryAt) {
      if (row.low <= signal.entry && row.high >= signal.entry) entryAt = new Date(row.closeTime);
      else continue;
      // Intrabar order is unknown. A stop in the entry minute counts; a target does not.
      if (row.low <= signal.stop) return result("closed", "stop", row, signal.stop);
      continue;
    }
    // If both boundaries are touched, use the adverse outcome. A gap through the stop uses the open.
    if (row.low <= signal.stop) return result("closed", "stop", row, Math.min(row.open, signal.stop));
    if (row.high >= signal.target) return result("closed", "target", row, signal.target);
  }
  if (!finished) return result(entryAt ? "open" : "waiting", "none");
  if (!entryAt) return result("expired", "no_entry");
  const last = eligible.at(-1)!;
  return result("closed", "time_exit", last, last.close);
}

export async function getPaperCandles(symbol: string, start: number, end: number): Promise<PaperCandle[]> {
  if (!/^(BTC|ETH|SOL)USDT$/.test(symbol)) throw new Error("Unsupported paper symbol");
  const dataBase = process.env.BINANCE_DATA_BASE_URL ?? "https://data-api.binance.vision";
  const url = `${dataBase}/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${start}&endTime=${end}&limit=1000`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Paper market data unavailable (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid paper market data");
  return rows.map(row => ({ openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), closeTime: Number(row[6]) }));
}
