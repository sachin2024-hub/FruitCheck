import { supabase, type Profile } from './supabase';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('id', userId).maybeSingle();
  if (error) {
    console.log('[FruitCheck] Profile load failed:', error.code, error.message);
    return null;
  }
  return data;
}

export async function updateFullName(userId: string, fullName: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
    .select('id');
  if (error || !data?.length) {
    console.log('[FruitCheck] Profile update failed:', error?.code, error?.message);
    throw new Error('Could not save your name. Please try again.');
  }
  // Keep auth metadata in step so the name is available before the profile loads.
  await supabase.auth.updateUser({ data: { full_name: fullName } });
}

export type ActiveModel = { model_name: string; version: string; architecture: string };

export async function getActiveModel(): Promise<ActiveModel | null> {
  const { data } = await supabase
    .from('model_versions')
    .select('model_name, version, architecture')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data;
}
