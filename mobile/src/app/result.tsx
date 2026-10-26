import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfidenceBar, RipenessBadge } from '@/components/scan';
import { Banner, Button, Card } from '@/components/ui';
import { ApiError, classifyImage, type PredictResult } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pct } from '@/lib/format';
import { removePhoto, uploadPhoto } from '@/lib/history';
import { labelText, parseLabel } from '@/lib/labels';
import { getPending, prepareForUpload, setPending, type PendingImage } from '@/lib/picker';
import { colors, radius, shadow, space, type } from '@/lib/theme';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; result: PredictResult };

export default function Result() {
  const { session } = useAuth();
  const [image] = useState(getPending());
  const [state, setState] = useState<State>({ kind: 'loading' });
  const running = useRef(false); // prevents duplicate submissions

  const run = useCallback(
    async (img: PendingImage) => {
      if (running.current) return;
      running.current = true;
      let photoPath: string | null = null;
      try {
        const uri = await prepareForUpload(img.uri, img.width);
        // Keep a private copy of the photo for history (best effort; the scan works without it).
        if (session) photoPath = await uploadPhoto(session.user.id, uri);
        const result = await classifyImage(uri, img.source, photoPath);
        if (photoPath && !result.saved) removePhoto(photoPath).catch(() => {});
        setState({ kind: 'done', result });
      } catch (e) {
        if (photoPath) removePhoto(photoPath).catch(() => {});
        if (!(e instanceof ApiError)) console.log('[FruitCheck] Unexpected classify error:', e);
        setState({
          kind: 'error',
          message: e instanceof ApiError ? e.message : 'Something went wrong while classifying the image.',
        });
      } finally {
        running.current = false;
      }
    },
    [session],
  );

  // Classify the image this screen was opened with, exactly once (a token refresh
  // changes `session`/`run`, which must not trigger a second submission).
  const started = useRef(false);
  useEffect(() => {
    if (!image || started.current) return;
    started.current = true;
    setTimeout(() => run(image), 0);
  }, [image, run]);

  if (!image) {
    router.replace('/scan');
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.frame}>
          <Image source={{ uri: image.uri }} style={styles.image} contentFit="cover" accessibilityLabel="Your fruit photo" />
          {state.kind === 'loading' && (
            <Animated.View entering={FadeIn} style={styles.scrim}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.scrimText}>Analyzing your fruit...</Text>
            </Animated.View>
          )}
        </View>

        {state.kind === 'loading' && (
          <Text style={[type.muted, { textAlign: 'center' }]}>This usually takes a few seconds.</Text>
        )}

        {state.kind === 'error' && (
          <Animated.View entering={FadeInDown} style={{ gap: space.sm }}>
            <Banner tone="error" title="Classification failed" text={state.message} />
            <Button
              label="Try Again"
              icon="refresh"
              onPress={() => {
                setState({ kind: 'loading' });
                run(image);
              }}
            />
          </Animated.View>
        )}

        {state.kind === 'done' && <ResultDetails result={state.result} />}

        {state.kind !== 'loading' && (
          <View style={{ gap: space.sm }}>
            <Button
              label="Scan Another Fruit"
              icon="camera"
              variant={state.kind === 'done' ? 'primary' : 'secondary'}
              onPress={() => {
                setPending(null); // the next scan must never reuse this photo or result
                router.dismissTo('/scan');
              }}
            />
            <Button label="View History" icon="time-outline" variant="outline" onPress={() => router.dismissTo('/history')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultDetails({ result }: { result: PredictResult }) {
  const p = parseLabel(result.predicted_class);
  const ranked = Object.entries(result.probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.md }}>
      <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={type.overline}>Predicted fruit</Text>
              <Text style={styles.fruit}>{p.fruit}</Text>
            </View>
            <RipenessBadge ripeness={p.ripeness} size="lg" />
          </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.heading}>Model confidence</Text>
            <Text style={[type.heading, { color: result.uncertain ? colors.accentText : colors.primary }]}>
              {pct(result.confidence)}
            </Text>
          </View>
          <ConfidenceBar value={result.confidence} low={result.uncertain} />
          <Text style={type.caption}>
            Confidence is how certain the model is about this photo. It is not the model’s overall accuracy and does
            not guarantee the result is correct.
          </Text>
        </View>
      </Card>

      {result.warnings?.map((w) => <Banner key={w} tone="warn" title="Photo quality" text={w} />)}

      {result.uncertain && (
        <Banner
          tone="warn"
          title="Low confidence"
          text="The model is less sure about this one. For a better result, retake it in good light with one fruit centred in the frame."
        />
      )}

      <Card style={{ gap: 10 }}>
        <Text style={type.overline}>Scores for each class</Text>
        {ranked.map(([label, v]) => (
          <View key={label} style={styles.scoreRow}>
            <Text style={[type.body, { flex: 1 }]}>{labelText(label)}</Text>
            <Text style={[type.muted, { fontVariant: ['tabular-nums'] }]}>{pct(v)}</Text>
          </View>
        ))}
      </Card>

      {result.saved ? (
        <Text style={[type.caption, { textAlign: 'center' }]}>Saved to your history.</Text>
      ) : (
        <Banner
          tone="warn"
          title="Not saved to history"
          text={`The result above is still valid, but it was not saved${
            result.save_error ? `: ${result.save_error}.` : '. Restart the backend so it can report the reason.'
          }`}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  frame: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, ...shadow },
  image: { width: '100%', aspectRatio: 1, backgroundColor: '#EEF2ED' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: space.md },
  scrimText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fruit: { fontSize: 34, fontWeight: '800', color: colors.text },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
});
