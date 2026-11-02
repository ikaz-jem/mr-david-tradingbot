import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { C } from '../lib/theme';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.lime} size="large"/></View>;
  return <Redirect href={user ? '/home' : '/login'}/>;
}
