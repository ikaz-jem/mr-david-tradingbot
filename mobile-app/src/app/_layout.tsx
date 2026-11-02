import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { PushSetup } from '../components/push-setup';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="light"/><PushSetup/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#07100B' }, animation: 'fade' }}/></AuthProvider></SafeAreaProvider>;
}
