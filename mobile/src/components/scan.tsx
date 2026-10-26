import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pct, relativeDate } from '@/lib/format';
import { parseLabel } from '@/lib/labels';
import type { ScanRecord } from '@/lib/supabase';
import { colors, radius, shadow, space } from '@/lib/theme';

export function RipenessBadge({ ripeness, size = 'md' }: { ripeness: 'ripe' | 'unripe' | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!ripeness) return null;
  const ripe = ripeness === 'ripe';
  const fs = size === 'lg' ? 16 : size === 'md' ? 13 : 11;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: ripe ? colors.ripeSoft : colors.unripeSoft },
        size === 'lg' && { paddingHorizontal: 16, paddingVertical: 8 },
        size === 'sm' && { paddingHorizontal: 8, paddingVertical: 3 },
      ]}
      accessibilityLabel={ripe ? 'Ripe' : 'Unripe'}>
      <Ionicons name={ripe ? 'sunny' : 'leaf'} size={fs + 2} color={ripe ? colors.ripe : colors.unripe} />
      <Text style={{ color: ripe ? colors.ripe : colors.unripe, fontWeight: '800', fontSize: fs, letterSpacing: 0.8 }}>
        {ripe ? 'RIPE' : 'UNRIPE'}
      </Text>
    </View>
  );
}

export function ConfidenceBar({ value, low }: { value: number; low?: boolean }) {
  const w = Math.max(2, Math.min(100, Math.round(value * 100)));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.fill, { width: `${w}%`, backgroundColor: low ? colors.accent : colors.primary }]} />
    </View>
  );
}

/** The user's own stored photo when available; otherwise a neutral placeholder (never a stock photo). */
export function ScanThumb({ uri, size = 56 }: { uri?: string; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.md }} contentFit="cover" transition={150} />
  ) : (
    <View style={[styles.thumbEmpty, { width: size, height: size }]} accessibilityLabel="No photo saved">
      <Ionicons name="image-outline" size={size * 0.4} color={colors.muted} />
    </View>
  );
}

export function ScanRow({
  scan,
  photo,
  onPress,
  onMenu,
}: {
  scan: ScanRecord;
  photo?: string;
  onPress: () => void;
  onMenu?: () => void;
}) {
  const p = parseLabel(scan.predicted_label);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.ripeness ?? ''} ${p.fruit}, ${pct(scan.confidence)} confidence, ${relativeDate(scan.created_at)}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <ScanThumb uri={photo} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle}>{p.fruit}</Text>
        <Text style={styles.rowSub}>
          {pct(scan.confidence)} confidence · {relativeDate(scan.created_at)}
        </Text>
      </View>
      <RipenessBadge ripeness={p.ripeness} size="sm" />
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      {onMenu && (
        <Pressable
          onPress={onMenu}
          hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: colors.mint }]}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.mint, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  thumbEmpty: { borderRadius: radius.md, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadow,
  },
  menuBtn: { width: 28, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted },
});
