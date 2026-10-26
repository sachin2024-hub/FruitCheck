import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile';

/** Display name and email of the signed-in user; reloads whenever the screen gains focus. */
export function useProfile() {
  const { session } = useAuth();
  const user = session?.user;
  const [fullName, setFullName] = useState<string | null>((user?.user_metadata?.full_name as string) ?? null);

  const reload = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    if (p?.full_name) setFullName(p.full_name);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { userId: user?.id ?? null, email: user?.email ?? null, fullName, setFullName, reload };
}
