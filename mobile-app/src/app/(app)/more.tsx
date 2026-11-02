import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Page, Panel, Muted, Section } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { C } from '../../lib/theme';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Item = { title: string; subtitle: string; href: string; icon: Icon };
const account: Item[] = [
  { title: 'Exchanges', subtitle: 'Connect and verify your trading accounts', href: '/exchanges', icon: 'swap-horizontal' },
  { title: 'Performance', subtitle: 'Orders, outcomes and tracked P&L', href: '/performance', icon: 'chart-line' },
  { title: 'Credits & billing', subtitle: 'Balance and payment history', href: '/credits', icon: 'circle-multiple-outline' },
  { title: 'Affiliates', subtitle: 'Referrals, commissions and payouts', href: '/affiliates', icon: 'account-multiple-outline' },
];
const service: Item[] = [
  { title: 'Notifications', subtitle: 'Updates across your workspace', href: '/notifications', icon: 'bell-outline' },
  { title: 'Support', subtitle: 'Private conversations with our team', href: '/support', icon: 'lifebuoy' },
  { title: 'Help center', subtitle: 'Guides and frequently asked questions', href: '/help', icon: 'help-circle-outline' },
  { title: 'Settings', subtitle: 'Profile, preferences and security', href: '/settings', icon: 'cog-outline' },
];

function NavigationGroup({ items }: { items: Item[] }) {
  return <Panel style={{ padding: 0, overflow: 'hidden' }}>{items.map((item, index) => <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(item.href as never)} style={[styles.row, index > 0 && styles.rowBorder]}><View style={styles.icon}><MaterialCommunityIcons name={item.icon} color={C.lime} size={21}/></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Muted>{item.subtitle}</Muted></View><MaterialCommunityIcons name="chevron-right" color={C.faint} size={21}/></Pressable>)}</Panel>;
}

export default function More() {
  const { user } = useAuth();
  return <Page title="Your workspace" eyebrow="ACCOUNT & DATA" subtitle="Everything you need to stay informed and in control.">
    <Pressable accessibilityRole="button" accessibilityLabel="Open account settings" onPress={() => router.push('/settings')}><Panel style={styles.profile}><View style={styles.avatar}><Text style={{ fontSize: 18, fontWeight: '900', color: C.bg }}>{(user?.name || 'U').slice(0, 2).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={{ color: C.white, fontWeight: '900', fontSize: 17 }}>{user?.name}</Text><Muted>{user?.email}</Muted></View><MaterialCommunityIcons name="chevron-right" color={C.lime} size={22}/></Panel></Pressable>
    <Section title="Account & trading" subtitle="Manage balances, connections and performance"/><NavigationGroup items={account}/>
    <Section title="Help & preferences" subtitle="Support and account controls"/><NavigationGroup items={service}/>
    <Section title="Legal & safety" subtitle="Current platform policies and trading disclosures"/>
    <Panel style={{ padding: 0, overflow: 'hidden' }}>{[['Terms of service', 'terms'], ['Privacy policy', 'privacy'], ['Risk disclosure', 'risk-disclosure']].map(([title, path], index) => <Pressable key={path} accessibilityRole="link" onPress={() => void Linking.openURL(`https://enriveasignal.com/${path}`)} style={[styles.legalRow, index > 0 && styles.rowBorder]}><Text style={{ color: C.white, fontWeight: '700', flex: 1 }}>{title}</Text><MaterialCommunityIcons name="open-in-new" color={C.muted} size={18}/></Pressable>)}</Panel>
    <Muted style={{ textAlign: 'center', marginTop: 13 }}>Enrivea Signal · A product of Enrivea</Muted>
  </Page>;
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#142719', borderColor: '#456A37', paddingVertical: 20 },
  avatar: { width: 50, height: 50, borderRadius: 15, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center' },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: C.white, fontSize: 15, fontWeight: '800' },
  legalRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
});
