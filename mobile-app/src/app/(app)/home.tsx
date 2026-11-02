import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Page, Hero, Section, Panel, Metric, Muted, Empty } from '../../components/ui';
import { Sparkline } from '../../components/chart';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/resource';
import { C } from '../../lib/theme';

export default function Home() {
  const { user } = useAuth();
  const load = useCallback(async () => Promise.all([api<any>('data?section=overview'), api<any>('proxy/market/overview')]).then(([account, market]) => ({ account, market })), []);
  const state = useResource(load);
  const account = state.data?.account; const market = state.data?.market;
  const main = market?.markets?.[0];
  return <Page title={`Good to see you, ${user?.name?.split(' ')[0] || 'trader'}.`} eyebrow="YOUR WORKSPACE" subtitle="Your research, exchange activity and market context in one focused view." loading={state.loading} error={state.error} onRefresh={() => void state.refresh()}>
    <Hero eyebrow="TRADE WITH A CLEARER VIEW" title="Make every move intentional." body="Scan the market, review the rationale, and decide when to act."><Pressable onPress={() => router.push('/research')} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 8 }}><Text style={{ color: C.lime, fontWeight: '900' }}>Run market research</Text><MaterialCommunityIcons name="arrow-top-right" color={C.lime} size={18}/></Pressable></Hero>
    {!account?.wallet?.activated ? <Panel style={{ borderColor: C.amber }}><Text style={{ color: C.amber, fontWeight: '900' }}>ACTIVATION REQUIRED</Text><Muted>Activate your account once to use the trading products. Your existing balance is shown below.</Muted></Panel> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 13 }}><Metric label="Credits available" value={account?.wallet?.balance ?? '—'} color={C.lime}/><Metric label="Research ideas" value={account?.signalCount ?? 0}/><Metric label="Exchange orders" value={account?.orderCount ?? 0}/><Metric label="Unread alerts" value={account?.unreadCount ?? 0}/></View>
    <Section title="Market pulse" subtitle="Live market data from the shared feed" action="Markets" onAction={() => router.push('/research')}/><Panel><Text style={{ color: C.white, fontSize: 16, fontWeight: '900' }}>{main?.symbol ? main.symbol.replace('USDT', '/USDT') : 'BTC/USDT'}</Text><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 }}><Text style={{ color: C.white, fontSize: 30, fontWeight: '900' }}>{main?.price ? `$${Number(main.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</Text><Text style={{ color: (main?.change ?? 0) >= 0 ? C.green : C.red, fontWeight: '800' }}>{main?.change != null ? `${main.change >= 0 ? '+' : ''}${Number(main.change).toFixed(2)}%` : ''}</Text></View><View style={{ marginTop: 18 }}><Sparkline values={(market?.history ?? []).map((point: { close: number }) => point.close)}/></View><Text style={{ color: C.faint, fontSize: 10, marginTop: 8 }}>Market data may be delayed. Verify execution prices at your exchange.</Text></Panel>
    <Section title="Trading Companion" subtitle="Three products, one disciplined workflow"/>
    {[["Research scanner", "Find and explain qualified market setups.", "/research", "radar"], ["Approval desk", "Review shared opportunities and decide to execute.", "/approval", "check-decagram-outline"], ["Autopilot", "Set risk limits for guarded futures automation.", "/autopilot", "robot-outline"]].map(([title, subtitle, href, icon]) => <Pressable key={title} onPress={() => router.push(href as never)}><Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={icon as never} color={C.lime} size={22}/></View><View style={{ flex: 1 }}><Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>{title}</Text><Muted>{subtitle}</Muted></View><MaterialCommunityIcons name="chevron-right" color={C.muted} size={23}/></Panel></Pressable>)}
    <Section title="Recent research" action="View all" onAction={() => router.push('/research')}/>{account?.recentSignals?.length ? account.recentSignals.map((row: any) => <Panel key={row._id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Text style={{ color: C.white, fontWeight: '800' }}>{row.symbol?.replace('USDT', '/USDT')} · {row.interval}</Text><Muted>{row.side === 'sell' ? 'Short' : 'Long'} · {row.status}</Muted></View><Text style={{ color: row.side === 'sell' ? C.red : C.lime, fontWeight: '900' }}>{row.confidence}%</Text></Panel>) : <Empty title="Your research starts here" body="Run your first scan to see a documented decision and risk analysis."/>}
  </Page>;
}
