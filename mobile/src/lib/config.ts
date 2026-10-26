// Deployed backend on Render (no trailing slash). Set EXPO_PUBLIC_API_URL to override,
// e.g. with a local backend while developing.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://fruitcheck-api.onrender.com').replace(/\/$/, '');
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

console.log('[FruitCheck] API URL:', API_URL);
if (/\/\/(localhost|127\.0\.0\.1)[:/]/.test(API_URL)) {
  // On a physical phone, localhost is the phone itself, not the computer.
  console.warn(
    '[FruitCheck] API URL points to localhost. On a physical phone use the computer LAN IP or an HTTPS backend URL.',
  );
}
