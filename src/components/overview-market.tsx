"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketOverview } from "@/lib/market";
import { MarketChart } from "@/components/market-chart";
import { SectionHeader } from "@/components/dashboard-ui";

export function OverviewMarket({ activated }: { activated: boolean }) {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false, busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await fetch("/api/market/overview", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) });
        if (!response.ok) throw new Error("Market request failed");
        const next: MarketOverview = await response.json();
        if (!Array.isArray(next.markets) || !Array.isArray(next.history) || !Number.isFinite(next.fetchedAt)) throw new Error("Invalid market data");
        if (!stopped) { setData(next); setFailed(false); setNow(Date.now()); }
      } catch { if (!stopped) { setFailed(true); setNow(Date.now()); } }
      finally { busy = false; }
    }
    void refresh();
    const timer = setInterval(() => { setNow(Date.now()); void refresh(); }, 30_000);
    const visible = () => { setNow(Date.now()); void refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, []);
  const stale = failed || Boolean(data && now - data.fetchedAt > 90_000);
  const stamp = data ? new Date(data.fetchedAt).toLocaleTimeString(undefined, { timeZone: "UTC" }) + " UTC" : "";
  return <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
    <section className="surface rounded-[20px] p-5 sm:p-6">
      <SectionHeader title="BTC market overview" detail="Binance Spot · Last 30 completed daily candles · UTC · USDT"/>
      {stale && <p role="status" className="mb-3 text-sm text-amber-300">Refresh failed or delayed — chart may be outdated.</p>}
      {!data && !failed ? <div className="flex h-[290px] items-center justify-center text-muted">Loading market history…</div> : <MarketChart data={data?.history ?? []}/>}
      <p className="mt-3 text-xs text-muted">Daily closing prices, not a live intraday chart. Today’s unfinished candle is excluded.</p>
    </section>
    <section className="surface rounded-[20px] p-5 sm:p-6">
      <SectionHeader title="Market pulse" detail="Binance Spot · Rolling 24-hour change · USDT"/>
      <p role="status" className={`mb-4 text-xs ${stale ? "text-amber-300" : "text-muted"}`}>{!data ? failed ? "Market data unavailable. Retrying automatically." : "Loading current quotes…" : `${stale ? "Delayed · Last fetched" : "Fetched"} ${stamp} · Refreshes every 30s`}</p>
      <div className="space-y-2">{data?.markets.map(market => <div key={market.symbol} className="flex items-center justify-between rounded-xl border border-line bg-[#151f18] px-4 py-3">
        <div><div className="text-sm font-bold">{market.symbol.replace("USDT", "")} <span className="text-muted">/ USDT</span></div><div className="mt-1 text-xs text-muted">{stale || now - market.updatedAt > 120_000 ? "Delayed quote" : "Spot last traded price"}</div></div>
        <div className="text-right"><div className="font-semibold number">{market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-muted">USDT</span></div><div className={`mt-1 text-xs font-bold number ${market.change >= 0 ? "text-accent" : "text-[#ff8791]"}`}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</div></div>
      </div>)}</div>
      {data && data.markets.length < 3 && <p className="mt-3 text-sm text-amber-300">Some quotes are unavailable. No simulated prices are substituted.</p>}
      <Link href={activated ? "/dashboard/signals" : "/dashboard/credits"} className="mt-5 block rounded-xl border border-[#557644] bg-[#c5ff4111] p-4 text-sm font-bold text-accent">{activated ? "Go to trade ideas →" : "Activate platform access →"}</Link>
    </section>
  </div>;
}
