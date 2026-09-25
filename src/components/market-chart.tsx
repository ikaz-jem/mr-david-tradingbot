"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CandlePoint } from "@/lib/market";

export function MarketChart({ data }: { data: CandlePoint[] }) {
  if (!data.length) return <div className="flex h-[290px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">Market history is temporarily unavailable.</div>;
  return <div className="h-[290px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 0, left: -19, bottom: 0 }}><defs><linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c5ff41" stopOpacity={0.26}/><stop offset="1" stopColor="#c5ff41" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#273329" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" tick={{ fill: "#8b9c8d", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28}/><YAxis domain={["dataMin", "dataMax"]} tick={{ fill: "#8b9c8d", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={value => `$${(Number(value) / 1000).toFixed(0)}k`}/><Tooltip contentStyle={{ background: "#18231b", border: "1px solid #456044", borderRadius: 12, color: "#fff" }} formatter={value => [`$${Number(value).toLocaleString()}`, "Close"]}/><Area type="monotone" dataKey="close" stroke="#c5ff41" strokeWidth={2.5} fill="url(#marketArea)" activeDot={{ r: 5, fill: "#c5ff41" }}/></AreaChart></ResponsiveContainer></div>;
}
