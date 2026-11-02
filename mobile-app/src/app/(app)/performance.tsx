import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Page, Panel, Section, Metric, Muted, Empty } from '../../components/ui';
import { Sparkline } from '../../components/chart';
import { api } from '../../lib/api';
import { useResource } from '../../lib/resource';
import { C } from '../../lib/theme';

export default function Performance() {
  const load = useCallback(() => api<any>('data?section=performance'), []);
  const state = useResource(load);
  const data = state.data;
  const orders = data?.orders ?? [];
  const paper = data?.paper ?? [];
  const paperStats = data?.paperStats;
  const paperReturns = paper.filter((row: any) => typeof row.netReturnPct === 'number').slice().reverse().map((row: any) => Number(row.netReturnPct));
  const winRate = paperStats?.count ? `${(paperStats.wins / paperStats.count * 100).toFixed(1)}%` : '—';
  const average = paperStats?.average == null ? '—' : `${paperStats.average >= 0 ? '+' : ''}${Number(paperStats.average).toFixed(2)}%`;
  return <Page title="Performance" eyebrow="YOUR RESULTS" subtitle="Research outcomes and actual exchange fills are shown separately." loading={state.loading} error={state.error} onRefresh={() => void state.refresh()}>
    <Panel style={{ borderColor: '#4C6C37', backgroundColor: '#132519' }}><Text style={{ color: C.lime, fontWeight: '900', fontSize: 10, letterSpacing: 1.5 }}>PERFORMANCE AT A GLANCE</Text><Text style={{ color: C.white, fontSize: 23, fontWeight: '900', marginTop: 8 }}>Results with context.</Text><Muted style={{ marginTop: 7 }}>Paper research uses assumed fills and costs. Exchange P&L requires confirmed trading records.</Muted></Panel>
    <Section title="Research scorecard" subtitle="Forward paper outcomes · simulated"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 12 }}><Metric label="Published ideas" value={data?.publishedIdeas ?? 0}/><Metric label="Paper exits" value={paperStats?.count ?? 0}/><Metric label="Paper win rate" value={winRate} color={C.lime}/><Metric label="Avg paper return" value={average} color={C.lime}/></View>
    <Panel><Text style={{ color: C.white, fontSize: 17, fontWeight: '900' }}>Paper outcome trend</Text><Muted>Net return by completed simulated exit</Muted>{paperReturns.length >= 2 ? <View style={{ marginTop: 18 }}><Sparkline values={paperReturns} height={135}/></View> : <Muted style={{ marginTop: 16 }}>More closed paper outcomes are needed to draw a trend.</Muted>}<Muted style={{ marginTop: 12 }}>Paper results include assumed fees and slippage. They are not account returns.</Muted></Panel>
    <Section title="Paper history" subtitle="Newest checked outcomes"/>
    {paper.length ? paper.map((row: any) => <Panel key={row._id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>{row.symbol?.replace('USDT', '/USDT') ?? 'Trade idea'}</Text><Text style={{ color: row.netReturnPct == null ? C.muted : Number(row.netReturnPct) >= 0 ? C.green : C.red, fontWeight: '900' }}>{row.netReturnPct == null ? '—' : `${Number(row.netReturnPct) >= 0 ? '+' : ''}${Number(row.netReturnPct).toFixed(2)}%`}</Text></View><Muted>{row.status} · {row.reason === 'none' ? 'Awaiting observation' : row.reason?.replace('_', ' ')}</Muted><Muted>Checked {new Date(row.checkedAt).toLocaleString()}</Muted></Panel>) : <Empty title="No paper outcomes yet" body="Published ideas are observed against later market candles. Results appear here after reconciliation." icon="chart-line"/>}
    <Section title="Actual exchange performance" subtitle="Confirmed fills and reconciled P&L"/>
    <View style={{ flexDirection: 'row', gap: 9, marginBottom: 11 }}><Metric label="Completed P&L" value={data?.completeCount ? `${Number(data.completePnl).toFixed(2)} USDT` : '—'} color={Number(data?.completePnl) >= 0 ? C.green : C.red}/><Metric label="Tracked orders" value={orders.length}/></View>
    <Panel><Text style={{ color: C.lime, fontWeight: '900', fontSize: 11 }}>DATA QUALITY</Text><Muted>Unrealized values and closed trade outcomes appear only when exchange tracking has enough data. Pending and stale states remain labeled.</Muted></Panel>
    <Section title="Exchange order history" subtitle="Newest first · Spot and Futures"/>
    {orders.length ? orders.map((row: any) => <Panel key={row._id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: C.white, fontSize: 17, fontWeight: '900' }}>{row.symbol?.replace('USDT', '/USDT')}</Text><Text style={{ color: row.side === 'SELL' ? C.red : C.lime, fontWeight: '900' }}>{row.side}</Text></View><Muted>{row.exchange?.replace('_', ' ')} · {row.source} · {row.status}</Muted><View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><Metric label="Notional" value={`${row.quoteAmount ?? 0} USDT`}/><Metric label="Net P&L" value={row.pnlComplete && row.netPnl != null ? `${Number(row.netPnl).toFixed(2)} USDT` : 'Pending'} color={row.pnlComplete ? Number(row.netPnl) >= 0 ? C.green : C.red : C.muted}/></View><Muted style={{ marginTop: 11 }}>Tracking: {row.trackingStatus} · Protection: {row.protectionStatus}</Muted><Muted>{new Date(row.createdAt).toLocaleString()}</Muted></Panel>) : <Empty title="No exchange orders yet" body="Executed Approval Desk and Autopilot trades appear here after exchange confirmation." icon="chart-line"/>}
  </Page>;
}
