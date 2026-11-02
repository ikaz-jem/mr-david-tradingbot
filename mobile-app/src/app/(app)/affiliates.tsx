import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Page, Panel, Section, Metric, Field, Button, Muted, Empty, Status } from '../../components/ui';
import { userApi, API_ORIGIN } from '../../lib/api';
import { useResource } from '../../lib/resource';
import { C } from '../../lib/theme';
import { SelectField } from '../../components/select-field';

export default function Affiliates() {
  const load = useCallback(() => userApi<any>('affiliates'), []); const state = useResource(load); const data = state.data;
  const [method, setMethod] = useState<'paystack' | 'nowpayments' | 'external'>('paystack');
  const [accountName, setAccountName] = useState(''); const [bankName, setBankName] = useState(''); const [accountNumber, setAccountNumber] = useState(''); const [asset, setAsset] = useState('USDT'); const [network, setNetwork] = useState('BEP20'); const [address, setAddress] = useState(''); const [label, setLabel] = useState(''); const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  useEffect(() => { if (data?.payoutProfile?.method) setMethod(data.payoutProfile.method); }, [data?.payoutProfile?.method]);
  const link = data?.code ? `${API_ORIGIN}/r/${data.code}` : '';
  async function shareLink() {
    if (!link) return;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ url: link, title: 'Enrivea Signal' });
        else { await Clipboard.setStringAsync(link); setMessage('Referral link copied.'); }
      } else await Share.share({ message: link });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setMessage('Could not share the referral link. Try Copy instead.');
    }
  }
  async function save() { setBusy(true); setMessage(''); try { const details = method === 'paystack' ? { accountName, bankName, accountNumber } : method === 'nowpayments' ? { asset, network, address } : { label, instructions }; const result = await userApi<any>('affiliates', 'POST', { method, revision: data?.payoutProfile?.revision ?? 0, ...details }); state.setData(result); setMessageTone('success'); setMessage('Payout details saved. Admin settlement remains manual.'); } catch (error) { setMessageTone('error'); setMessage(error instanceof Error ? error.message : 'Could not save payout details.'); } finally { setBusy(false); } }
  return <Page title="Affiliates" eyebrow="GROW WITH ENRIVEA" subtitle="Invite others and follow first-activation commissions through their hold and settlement stages." loading={state.loading} error={state.error} onRefresh={() => void state.refresh()}>
    <Panel style={{ backgroundColor: '#172B19', borderColor: '#647C40' }}><Text style={{ color: C.lime, fontSize: 10, letterSpacing: 1.6, fontWeight: '900' }}>YOUR REFERRAL LINK</Text><Text selectable style={{ color: C.white, fontWeight: '800', fontSize: 13, marginTop: 11 }}>{link}</Text><View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><View style={{ flex: 1 }}><Button title="Copy" secondary onPress={() => void Clipboard.setStringAsync(link).then(() => setMessage('Referral link copied.')).catch(() => setMessage('Could not copy the referral link.'))}/></View><View style={{ flex: 1 }}><Button title="Share" onPress={() => void shareLink()}/></View></View></Panel>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}><Metric label="Referrals" value={data?.referralCount ?? 0}/><Metric label="Commission rows" value={data?.total ?? 0}/></View><Panel><Text style={{ color: C.white, fontWeight: '900' }}>Commission rules</Text><Muted>{data?.config?.enabled ? 'Active' : 'Paused'} · {data?.config?.rewardType === 'percentage' ? `${((data?.config?.rates?.[0] ?? 0) / 100).toFixed(1)}% direct reward` : 'Fixed reward'} · {data?.config?.holdDays ?? 14}-day hold. Commission applies only to the referred account's first activation purchase.</Muted></Panel>
    {message ? <Status message={message} tone={messageTone}/> : null}
    <Section title="Commission balances"/>{data?.balances?.length ? data.balances.map((row: any, index: number) => <Panel key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Text style={{ color: C.white, fontWeight: '800' }}>{row._id?.status}</Text><Muted>{row.count} commission{row.count === 1 ? '' : 's'}</Muted></View><Text style={{ color: C.lime, fontWeight: '900' }}>{(Number(row.amountMinor) / 100).toFixed(2)} {row._id?.currency}</Text></Panel>) : <Empty title="No commission yet" body="When a referred account activates for the first time, its eligible commission appears here." icon="account-multiple-outline"/>}
    <Section title="Payout destination" subtitle="Admin reviews and sends available commissions manually."/><Panel>{data?.payoutProfile?.configured ? <Muted>Current: {data.payoutProfile.label} · {data.payoutProfile.maskedDestination}</Muted> : null}<SelectField label="Payout method" value={method} onChange={value => setMethod(value as typeof method)} options={[{ value: 'paystack', label: 'Bank / Paystack' }, { value: 'nowpayments', label: 'Crypto wallet' }, { value: 'external', label: 'External payment' }]}/>{method === 'paystack' ? <><Field label="Account holder name" value={accountName} onChangeText={setAccountName}/><Field label="Bank name" value={bankName} onChangeText={setBankName}/><Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric"/></> : method === 'nowpayments' ? <><Field label="Asset" value={asset} onChangeText={setAsset}/><Field label="Network" value={network} onChangeText={setNetwork}/><Field label="Wallet address" value={address} onChangeText={setAddress}/></> : <><Field label="Payment method label" value={label} onChangeText={setLabel}/><Field label="Instructions" value={instructions} onChangeText={setInstructions} multiline/></>}<Button title="Save payout destination" onPress={() => void save()} loading={busy}/></Panel>
    <Section title="Your referrals" subtitle="Identity is masked to protect account privacy."/>{data?.referrals?.length ? data.referrals.map((row: any) => <Panel key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Text style={{ color: C.white, fontWeight: '800' }}>{row.name}</Text><Muted>{new Date(row.createdAt).toLocaleDateString()}</Muted></View><Text style={{ color: row.converted ? C.green : C.muted, fontWeight: '800' }}>{row.converted ? 'Activated' : 'Pending'}</Text></Panel>) : <Empty title="No referrals yet" body="Share your link to start building your network." icon="account-plus-outline"/>}
    <Section title="Commission history"/>{data?.rows?.map((row: any) => <Panel key={row.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: C.white, fontWeight: '900' }}>{row.buyer}</Text><Text style={{ color: C.lime, fontWeight: '900' }}>{(Number(row.amountMinor) / 100).toFixed(2)} {row.currency}</Text></View><Muted>Level {row.level} · {row.status} · Available {new Date(row.availableAt).toLocaleDateString()}</Muted></Panel>)}
  </Page>;
}
