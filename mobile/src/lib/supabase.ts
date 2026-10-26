import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Tables from supabase/migrations/20261022000000_fruitcheck_schema.sql.
export const HISTORY_TABLE = 'classifications';
export const IMAGE_BUCKET = 'fruit-images';

export type ScanRecord = {
  id: string;
  predicted_label: string;
  ripeness: 'ripe' | 'unripe';
  confidence: number;
  image_source: 'camera' | 'gallery';
  image_path: string | null;
  created_at: string;
};

export type ScanDetail = ScanRecord & {
  fruit_types: { display_name: string } | null;
  model_versions: { model_name: string; version: string; architecture: string } | null;
};

export type Profile = { id: string; full_name: string | null };
