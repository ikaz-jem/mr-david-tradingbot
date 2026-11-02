import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '../../lib/auth';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) return null;
  if (!user) return <Redirect href="/login"/>;
  if (user.mustChangePassword && pathname !== '/settings') return <Redirect href="/settings"/>;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }}/>
}
