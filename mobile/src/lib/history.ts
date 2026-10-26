import { File } from 'expo-file-system';

import { FRUITS, labelText, type FruitSlug, type Ripeness } from './labels';
import { HISTORY_TABLE, IMAGE_BUCKET, supabase, type ScanDetail, type ScanRecord } from './supabase';

const COLUMNS = 'id, predicted_label, ripeness, confidence, image_source, image_path, created_at';
export const PAGE_SIZE = 20;

export class HistoryError extends Error {}

function fail(context: string, e: { code?: string; message: string }): never {
  console.log(`[FruitCheck] ${context} failed:`, e.code, e.message);
  if (e.code === 'PGRST205') {
    throw new HistoryError('The history table is missing. Run the Supabase migration in supabase/migrations.');
  }
  throw new HistoryError('Could not reach the database. Check your connection and try again.');
}

const toRecord = <T extends ScanRecord>(r: T): T => ({ ...r, confidence: Number(r.confidence) });

export type HistoryFilter = { fruit: FruitSlug | null; ripeness: Ripeness | null; search: string };

/** Model labels that satisfy the filters. Search words must each start a word of the
 *  readable label, so "ripe" matches "Ripe Mango" but not "Unripe Mango". */
export function matchingLabels(filter: HistoryFilter): string[] {
  const words = filter.search.toLowerCase().split(/\s+/).filter(Boolean);
  return FRUITS.flatMap((f) => (['ripe', 'unripe'] as const).map((r) => ({ f: f.slug, r, label: `${f.slug}_${r}` })))
    .filter(({ f, r }) => (!filter.fruit || filter.fruit === f) && (!filter.ripeness || filter.ripeness === r))
    .filter(({ label }) => {
      const parts = labelText(label).toLowerCase().split(' ');
      return words.every((w) => parts.some((p) => p.startsWith(w)));
    })
    .map(({ label }) => label);
}

/** One page of the signed-in user's scans (RLS limits rows to the owner). */
export async function listScans(filter: HistoryFilter, page: number): Promise<ScanRecord[]> {
  const filtered = filter.fruit || filter.ripeness || filter.search.trim();
  const labels = filtered ? matchingLabels(filter) : null;
  if (labels && !labels.length) return [];
  let q = supabase.from(HISTORY_TABLE).select(COLUMNS).order('created_at', { ascending: false });
  if (labels) q = q.in('predicted_label', labels);
  const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) fail('History load', error);
  return (data ?? []).map((r) => toRecord(r as ScanRecord));
}

export async function getScan(id: string): Promise<ScanDetail | null> {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select(`${COLUMNS}, fruit_types(display_name), model_versions(model_name, version, architecture)`)
    .eq('id', id)
    .maybeSingle();
  if (error) fail('Scan load', error);
  return data ? toRecord(data as unknown as ScanDetail) : null;
}

export async function deleteScan(scan: Pick<ScanRecord, 'id' | 'image_path'>): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE).delete().eq('id', scan.id);
  if (error) fail('Delete', error);
  if (scan.image_path) {
    const { error: e } = await supabase.storage.from(IMAGE_BUCKET).remove([scan.image_path]);
    if (e) console.log('[FruitCheck] Photo delete failed:', e.message);
  }
}

export type Stats = { total: number; ripe: number; unripe: number; recent: ScanRecord[] };

export async function getStats(): Promise<Stats> {
  const count = (ripeness?: Ripeness) => {
    let q = supabase.from(HISTORY_TABLE).select('id', { count: 'exact', head: true });
    if (ripeness) q = q.eq('ripeness', ripeness);
    return q;
  };
  const [all, ripe, unripe, recent] = await Promise.all([
    count(),
    count('ripe'),
    count('unripe'),
    supabase.from(HISTORY_TABLE).select(COLUMNS).order('created_at', { ascending: false }).limit(3),
  ]);
  const err = all.error ?? ripe.error ?? unripe.error ?? recent.error;
  if (err) fail('Stats load', err);
  return {
    total: all.count ?? 0,
    ripe: ripe.count ?? 0,
    unripe: unripe.count ?? 0,
    recent: (recent.data ?? []).map((r) => toRecord(r as ScanRecord)),
  };
}

/** Short-lived URLs for photos in the private bucket. Missing photos map to undefined. */
export async function signedPhotoUrls(paths: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(unique, 60 * 60);
  if (error) {
    console.log('[FruitCheck] Signed URL failed:', error.message);
    return {};
  }
  return Object.fromEntries(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  );
}

/** Stores the photo in the user's private folder (<uid>/<name>.jpg, enforced by storage RLS). */
export async function uploadPhoto(userId: string, uri: string): Promise<string | null> {
  try {
    const bytes = await new File(uri).bytes();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      console.log('[FruitCheck] Photo upload failed:', error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.log('[FruitCheck] Photo upload failed:', (e as Error).message);
    return null;
  }
}

export async function removePhoto(path: string): Promise<void> {
  await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}
