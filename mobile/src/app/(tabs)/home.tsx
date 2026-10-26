import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScanRow } from '@/components/scan';
import { Banner, Button, Card, Empty, SectionHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useProfile';
import { greeting, initials } from '@/lib/format';
import { getStats, signedPhotoUrls, type Stats } from '@/lib/history';
import { FRUIT_PHOTOS } from '@/lib/labels';
import { pickFromGallery, setPending } from '@/lib/picker';
import { colors, radius, shadow, space, type } from '@/lib/theme';

export default function Home() {
  const { fullName, email } = useProfile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
      setError(null);
      setPhotos(await signedPhotoUrls(s.recent.map((r) => r.image_path)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upload = async () => {
    setPickError(null);
    const r = await pickFromGallery();
    if (r.kind === 'invalid') setPickError(r.message);
    else if (r.kind === 'ok') {
      setPending(r.image);
      router.push('/preview');
    }
  };

  const firstName = fullName?.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.muted}>{greeting()},</Text>
            <Text style={type.title} numberOfLines={1}>
              {firstName ?? 'Welcome'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName, email)}</Text>
          </Pressable>
        </View>

        <Text style={type.display}>Check Your Fruit’s Ripeness.</Text>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View style={styles.heroPhotos}>
            {(['apple-ripe', 'banana-ripe', 'mango-ripe'] as const).map((k, i) => (
              <Image
                key={k}
                source={FRUIT_PHOTOS[k]}
                style={[styles.heroPhoto, { marginLeft: i ? -18 : 0, zIndex: 3 - i }]}
                contentFit="cover"
              />
            ))}
          </View>
          <Text style={styles.heroTitle}>Apple · Banana · Mango</Text>
          <Text style={styles.heroText}>
            Photograph one fruit in good light and FruitCheck will classify it as ripe or unripe.
          </Text>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button label="Scan a Fruit" icon="camera" onPress={() => router.push('/scan')} style={styles.heroPrimary} />
            <Button label="Upload Image" icon="images-outline" variant="onDark" onPress={upload} />
          </View>
        </Animated.View>

        {pickError && <Banner tone="warn" text={pickError} />}

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.stats}>
          <Stat label="Total scans" value={stats?.total} />
          <Stat label="Ripe" value={stats?.ripe} tone={colors.ripe} />
          <Stat label="Unripe" value={stats?.unripe} tone={colors.unripe} />
        </Animated.View>

        <SectionHeader
          title="Recent scans"
          action={
            stats?.total ? (
              <Pressable onPress={() => router.push('/history')} hitSlop={8}>
                <Text style={styles.link}>See all</Text>
              </Pressable>
            ) : undefined
          }
        />

        {error && <Banner tone="error" text={error} action={<Button variant="secondary" label="Retry" onPress={load} />} />}

        {stats && stats.recent.length === 0 && !error && (
          <Card>
            <Empty
              icon="leaf-outline"
              title="No scans yet"
              text="Your classifications will appear here after your first scan."
            />
          </Card>
        )}

        <View style={{ gap: space.sm }}>
          {stats?.recent.map((s) => (
            <ScanRow
              key={s.id}
              scan={s}
              photo={s.image_path ? photos[s.image_path] : undefined}
              onPress={() => router.push({ pathname: '/record/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: string }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value ?? 'loading'}`}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value ?? '–'}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
    ...shadow,
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 17 },
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: space.lg, gap: 6, ...shadow },
  heroPhotos: { flexDirection: 'row', marginBottom: space.sm },
  heroPhoto: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.primaryDark, backgroundColor: '#fff' },
  heroTitle: { color: colors.accent, fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },
  heroText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 },
  heroPrimary: { backgroundColor: colors.primary },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: 12,
    gap: 2,
    ...shadow,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
