import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { Brand, Button, Field, Muted } from '../components/ui';
import { C } from '../lib/theme';

export default function Forgot() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit() { setBusy(true); try { const result = await api<{ message: string }>('proxy/auth/forgot-password', 'POST', { email }); setMessage(result.message); } catch (err) { setMessage(err instanceof Error ? err.message : 'Try again shortly.'); } finally { setBusy(false); } }
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 24, paddingTop: 38 }}><Brand/><Text style={{ color: C.white, fontSize: 36, fontWeight: '900', marginTop: 45 }}>Reset your password</Text><Muted>We will email a secure reset link. It opens the Enrivea website to complete your password change.</Muted><View style={{ height: 28 }}/><Field label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com"/>{message ? <Text style={{ color: C.green, marginBottom: 14 }}>{message}</Text> : null}<Button title="Send reset link" onPress={() => void submit()} loading={busy}/><Button title="Back to sign in" secondary onPress={() => router.replace('/login')}/></ScrollView></SafeAreaView>;
}
