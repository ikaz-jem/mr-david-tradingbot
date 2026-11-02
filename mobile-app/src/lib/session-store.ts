import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'enrivea.mobile.session.v1';

export async function getToken() { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function saveToken(value: string) { await SecureStore.setItemAsync(TOKEN_KEY, value); }
export async function clearToken() { await SecureStore.deleteItemAsync(TOKEN_KEY); }
