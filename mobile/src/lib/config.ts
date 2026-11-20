import Constants from 'expo-constants';

// In development the API is reached through the Expo dev server's /fruitcheck-api proxy
// (see metro.config.js), using the same address the phone loaded the app from.
// Installed builds (APK) have no dev server, so they fall back to the deployed backend on Render.
// Set EXPO_PUBLIC_API_URL to override either.
const DEPLOYED_API_URL = 'https://fruitcheck-api.onrender.com';

function devProxyUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return '';
  // LAN addresses (192.168.x.x:8081) are plain HTTP. Tunnel hosts (`npm run start:cf`,
  // e.g. xxx.trycloudflare.com) must use HTTPS: Android blocks cleartext requests to them.
  const host = hostUri.split(':')[0];
  const isLan = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost';
  return `${isLan ? 'http' : 'https'}://${hostUri}/fruitcheck-api`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || devProxyUrl() || DEPLOYED_API_URL).replace(/\/$/, '');
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

console.log('[FruitCheck] API URL:', API_URL);
if (/\/\/(localhost|127\.0\.0\.1)[:/]/.test(API_URL)) {
  // On a physical phone, localhost is the phone itself, not the computer.
  console.warn(
    '[FruitCheck] API URL points to localhost. On a physical phone use the computer LAN IP or an HTTPS backend URL.',
  );
}
