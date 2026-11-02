import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { Brand, Button, Field, Muted } from '../components/ui';
import { C } from '../lib/theme';

export default function Register() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); try { await api('proxy/auth/register', 'POST', { name, email, password, referralCode }); setNotice('Account created. Check your email to verify it, then sign in.'); } catch (err) { setError(err instanceof Error ? err.message : 'Could not create account.'); } finally { setBusy(false); } }
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 24, paddingTop: 38 }} keyboardShouldPersistTaps="handled"><Brand/><Text style={{ color: C.white, fontSize: 36, fontWeight: '900', letterSpacing: -2, marginTop: 38 }}>Start with a clearer view.</Text><Muted>Create your workspace and discover a more disciplined way to trade.</Muted><View style={{ height: 28 }}/>
    <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name"/><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com"/><Field label="Password · 12+ characters" value={password} onChangeText={setPassword} secureTextEntry placeholder="Create a strong password"/><Field label="Referral code · optional" value={referralCode} onChangeText={setReferralCode} placeholder="Have an invitation?"/>
    {error ? <Text style={{ color: C.red, marginBottom: 12 }}>{error}</Text> : null}{notice ? <Text style={{ color: C.green, marginBottom: 12 }}>{notice}</Text> : null}<Button title="Create account" onPress={() => void submit()} loading={busy}/><Button title="Back to sign in" onPress={() => router.replace('/login')} secondary/>
  </ScrollView></SafeAreaView>;
}
