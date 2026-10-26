import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfidenceBar, RipenessBadge, ScanThumb } from '@/components/scan';
import { Banner, Button, Card } from '@/components/ui';
import { formatDate, pct } from '@/lib/format';
import { deleteScan, getScan, signedPhotoUrls } from '@/lib/history';
import { parseLabel } from '@/lib/labels';
import type { ScanDetail } from '@/lib/supabase';
import { colors, radius, shadow, space, type } from '@/lib/theme';

const LOW_CONFIDENCE = 0.7; // same default as the backend's CONFIDENCE_THRESHOLD

export default function Record() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getScan(id);
        if (!s) return setError('This scan no longer exists.');
        setScan(s);
        if (s.image_path) setPhoto((await signedPhotoUrls([s.image_path]))[s.image_path]);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  const remove = () =>
    Alert.alert('Delete this scan?', 'The result and its photo will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!scan) return;
          setDeleting(true);
          try {
            await deleteScan(scan);
            router.back(); // the history list reloads when it regains focus
          } catch (e) {
            setDeleting(false);
            Alert.alert('Could not delete', (e as Error).message);
          }
        },
      },
    ]);

  if (error) {
    return (
      <View style={styles.pad}>
        <Banner tone="error" text={error} />
      </View>
    );
  }
  if (!scan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const p = parseLabel(scan.predicted_label);
  const model = scan.model_versions;
  const details: [string, string][] = [
    ['Fruit type', scan.fruit_types?.display_name ?? p.fruit],
    ['Ripeness', scan.ripeness === 'ripe' ? 'Ripe' : 'Unripe'],
    ['Model confidence', pct(scan.confidence)],
    ['Image source', scan.image_source === 'camera' ? 'Camera' : 'Gallery'],
    ['Model version', model ? `${model.model_name} ${model.version} (${model.architecture})` : 'Not recorded'],
    ['Date', formatDate(scan.created_at)],
  ];

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.frame}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.image} contentFit="cover" accessibilityLabel="Saved fruit photo" />
        ) : (
          <View style={[styles.image, styles.noPhoto]}>
            <ScanThumb size={72} />
            <Text style={type.muted}>No photo was saved for this scan.</Text>
          </View>
        )}
      </View>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.fruit}>{p.fruit}</Text>
          <RipenessBadge ripeness={p.ripeness} size="lg" />
        </View>
        <ConfidenceBar value={scan.confidence} low={scan.confidence < LOW_CONFIDENCE} />
        {details.map(([k, v]) => (
          <View key={k} style={styles.detail}>
            <Text style={type.muted}>{k}</Text>
            <Text style={[type.body, { fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
          </View>
        ))}
        <Text style={type.caption}>
          Confidence is the model’s certainty for this photo, not its overall accuracy.
        </Text>
      </Card>

      <Button label="Delete Scan" icon="trash-outline" variant="danger" onPress={remove} loading={deleting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, ...shadow },
  image: { width: '100%', aspectRatio: 1, backgroundColor: '#EEF2ED' },
  noPhoto: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  fruit: { fontSize: 30, fontWeight: '800', color: colors.text },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
});
