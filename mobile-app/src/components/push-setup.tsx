import { useEffect } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export function PushSetup() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !Device.isDevice) return;
    let cancelled = false;
    async function register() {
      try {
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('enrivea-updates', { name: 'Enrivea updates', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 180, 250], lightColor: '#C5FF43' });
        const current = await Notifications.getPermissionsAsync();
        const granted = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
        if (granted.status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!cancelled) await api('push', 'POST', { token, platform: Platform.OS });
      } catch (error) { console.warn('Push registration will retry on next app open', error); }
    }
    void register();
    const response = Notifications.addNotificationResponseReceivedListener(() => router.push('/notifications'));
    void Notifications.getLastNotificationResponseAsync().then(async last => {
      if (cancelled || !last) return;
      await Notifications.clearLastNotificationResponseAsync();
      router.push('/notifications');
    }).catch(() => undefined);
    return () => { cancelled = true; response.remove(); };
  }, [user?.id]);
  return null;
}
