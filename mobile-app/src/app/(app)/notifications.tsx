import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Page, Panel, Section, Button, Muted, Empty, Status } from '../../components/ui';
import { api, userApi } from '../../lib/api';
import { useResource } from '../../lib/resource';
import { C } from '../../lib/theme';

export default function Notifications() {
  const load = useCallback(() => api<any>('data?section=notifications'), []); const state = useResource(load); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  async function mark(id?: string) { setBusy(true); setMessage(''); try { await userApi('notifications', 'PATCH', id ? { id } : { all: true }); await state.refresh(true); setMessageTone('success'); setMessage('Notifications updated.'); } catch (error) { setMessageTone('error'); setMessage(error instanceof Error ? error.message : 'Could not update notifications.'); } finally { setBusy(false); } }
  const items = state.data?.notifications ?? [];
  return <Page title="Notifications" eyebrow="STAY INFORMED" subtitle="Research, billing, exchange, and account events in one place." loading={state.loading} error={state.error} onRefresh={() => void state.refresh()}>
    <Section title={`${items.filter((item: any) => !item.readAt).length} unread`} action="Mark all read" onAction={() => void mark()}/>{message ? <Status message={message} tone={messageTone}/> : null}
    {items.length ? items.map((item: any) => <Panel key={item._id} style={{ borderColor: item.readAt ? C.line : C.lime }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: C.white, fontSize: 15, fontWeight: '900', flex: 1 }}>{item.title}</Text><Text style={{ color: C.lime, fontSize: 10, fontWeight: '900' }}>{item.kind?.toUpperCase()}</Text></View><Muted>{item.body}</Muted><Text style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>{new Date(item.createdAt).toLocaleString()}</Text>{!item.readAt ? <Button title="Mark as read" secondary disabled={busy} onPress={() => void mark(item._id)}/> : null}</Panel>) : <Empty title="You're all caught up" body="Important account and trading updates will arrive here and on your phone when push is enabled." icon="bell-outline"/>}
  </Page>;
}
