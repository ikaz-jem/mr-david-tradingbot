import React, { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Page, Panel, Section, Button, Muted, Empty, Status } from '../../components/ui';
import { api } from '../../lib/api';
import { useResource } from '../../lib/resource';
import { C } from '../../lib/theme';
import { SelectField } from '../../components/select-field';

export default function Help() {
  const load = useCallback(() => api<any>('help'), []); const state = useResource(load);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all'); const [article, setArticle] = useState<any>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const items = (state.data?.articles ?? []).filter((row: any) => (category === 'all' || row.categorySlug === category) && `${row.title} ${row.summary}`.toLowerCase().includes(query.toLowerCase()));
  async function open(slug: string) { setBusy(true); setMessage(''); try { const result = await api<any>(`help?slug=${encodeURIComponent(slug)}`); setArticle(result.article); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open article.'); } finally { setBusy(false); } }
  return <Page title={article ? article.title : 'Help center'} eyebrow="GUIDES & ANSWERS" subtitle={article ? article.summary : 'Find clear answers about research, exchanges, billing and account safety.'} loading={state.loading} error={state.error} onRefresh={() => void state.refresh()}>
    {article ? <><Button title="Back to help center" secondary onPress={() => setArticle(null)}/><Panel style={{ marginTop: 15 }}><Text style={{ color: C.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>{article.categorySlug?.toUpperCase()}</Text>{String(article.body).split(/\n\n+/).map((paragraph, index) => <Text key={index} style={{ color: paragraph.startsWith('#') ? C.white : C.muted, fontSize: paragraph.startsWith('#') ? 18 : 14, fontWeight: paragraph.startsWith('#') ? '900' : '400', lineHeight: 23, marginTop: 15 }}>{paragraph.replace(/^#{1,4}\s*/, '')}</Text>)}</Panel></> : <><View style={{ borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15 }}><MaterialCommunityIcons name="magnify" color={C.muted} size={21}/><TextInput value={query} onChangeText={setQuery} placeholder="Search help articles" placeholderTextColor={C.faint} style={{ color: C.white, flex: 1, paddingVertical: 14 }}/></View><SelectField label="Topic" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All topics' }, ...(state.data?.categories ?? []).map((row: any) => ({ value: row.slug, label: row.title }))]}/>{message ? <Status message={message} tone="error"/> : null}<Section title={`${items.length} articles`} subtitle="Reviewed platform guidance"/>{items.length ? items.map((row: any) => <Pressable key={row.slug} onPress={() => void open(row.slug)} disabled={busy}><Panel style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: C.white, fontSize: 15, fontWeight: '900' }}>{row.title}</Text><Muted>{row.summary}</Muted></View><MaterialCommunityIcons name="arrow-top-right" size={20} color={C.lime}/></Panel></Pressable>) : <Empty title="No matching articles" body="Try another topic or search term." icon="book-search-outline"/>}</>}
  </Page>;
}
