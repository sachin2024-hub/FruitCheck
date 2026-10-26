import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, Card } from '@/components/ui';
import { cropToGuide, pickFromGallery, setPending, type GuideRect } from '@/lib/picker';
import { colors, radius, space, type } from '@/lib/theme';

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const active = useAppActive();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [capturing, setCapturing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(0); // new value = brand-new camera instance
  useFocusEffect(
    useCallback(() => {
      // Every visit starts clean: no previous photo, error or half-finished capture, and a fresh
      // camera instance (the old one was unmounted when the tab lost focus).
      setPending(null);
      setError(null);
      setCapturing(false);
      setReady(false);
      setSession((n) => n + 1);
      // Mount the camera only after the screen transition has finished. Starting it while the tab is still
      // animating in (e.g. after "Scan Another Fruit") leaves the native preview surface at a stale, smaller
      // size, which shows up as a black area under the picture.
      const timer = setTimeout(() => setFocused(true), 400);
      return () => {
        clearTimeout(timer);
        setFocused(false);
        setReady(false);
        setTorch(false);
      };
    }, []),
  );

  const root = useRef<View>(null);
  // 9:16 box that covers the whole screen area (centred, overflow clipped by the container), so no black
  // band is left over and the picture is cropped, never stretched. The photo maps onto the screen with
  // the same cover scale that cropToGuide uses.
  const previewSize = (() => {
    const width = Math.max(viewSize.width, (viewSize.height * 9) / 16);
    const height = (width * 16) / 9;
    return { width, height, top: (viewSize.height - height) / 2, left: (viewSize.width - width) / 2 };
  })();
  const guideBox = useRef<View>(null);

  // Guide position relative to the camera view, in the same units the preview is drawn in.
  const measureGuide = () =>
    new Promise<GuideRect | null>((resolve) => {
      if (!root.current || !guideBox.current) return resolve(null);
      root.current.measureInWindow((rx, ry, viewWidth, viewHeight) => {
        guideBox.current?.measureInWindow((gx, gy, size) => {
          resolve(viewWidth && size ? { x: gx - rx, y: gy - ry, size, viewWidth, viewHeight } : null);
        });
      });
    });

  const capture = async () => {
    if (!camera.current || !ready || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      // Short pause so the tap's shake settles and autofocus locks before the shot (sharper, less blur).
      await new Promise((r) => setTimeout(r, 250));
      const photo = await camera.current.takePictureAsync({ quality: 1, shutterSound: false });
      if (!photo?.uri) throw new Error('No photo returned');
      const guide = await measureGuide();
      const cropped = guide ? await cropToGuide(photo.uri, guide) : null;
      setPending(cropped ?? { uri: photo.uri, width: photo.width, source: 'camera' });
      router.push('/preview');
    } catch (e) {
      console.log('[FruitCheck] Capture failed:', (e as Error).message);
      setError('Could not take the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const gallery = async () => {
    setError(null);
    const r = await pickFromGallery();
    if (r.kind === 'invalid') setError(r.message);
    else if (r.kind === 'ok') {
      setPending(r.image);
      router.push('/preview');
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permWrap} edges={['top']}>
        <Card style={{ gap: space.md, alignItems: 'center' }}>
          <View style={styles.permIcon}>
            <Ionicons name="camera-outline" size={34} color={colors.primary} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>Camera access needed</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            FruitCheck uses the camera only to photograph the fruit you want to classify. Photos are kept private to
            your account.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Allow camera" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
          ) : (
            <>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                Camera access was turned off. Enable it for FruitCheck in your phone settings.
              </Text>
              <Button label="Open settings" icon="settings-outline" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
            </>
          )}
          <Button label="Upload from gallery instead" icon="images-outline" variant="secondary" onPress={gallery} style={{ alignSelf: 'stretch' }} />
        </Card>
        {error && <Banner tone="warn" text={error} />}
      </SafeAreaView>
    );
  }

  return (
    <View
      ref={root}
      collapsable={false}
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewSize((s) => (s.width === width && s.height === height ? s : { width, height }));
      }}>
      {/* The camera is told the same 9:16 ratio as its box, so it fills the box exactly. The box covers the
          screen area. Only keep the camera running while this tab is visible and the app is in the
          foreground. */}
      <View style={[styles.preview, previewSize]}>
        {focused && active && viewSize.width > 0 && (
          <CameraView
            key={session}
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            ratio="16:9"
            animateShutter={false}
            autofocus="on"
            enableTorch={torch}
            onCameraReady={() => setReady(true)}
            onMountError={(e) => setError(`Camera could not start: ${e.message}`)}
          />
        )}
      </View>

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Scan a fruit</Text>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            style={styles.roundBtn}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}>
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.guideArea} pointerEvents="none">
          <View ref={guideBox} collapsable={false} style={styles.guide}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, cornerStyle[c]]} />
            ))}
          </View>
          <Text style={styles.hint}>Place one apple, banana or mango inside the frame</Text>
        </View>

        {error && (
          <View style={{ paddingHorizontal: space.md }}>
            <Banner tone="warn" text={error} />
          </View>
        )}

        <View style={styles.controls}>
          <Pressable onPress={gallery} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Upload from gallery">
            <Ionicons name="images" size={24} color="#fff" />
            <Text style={styles.sideText}>Gallery</Text>
          </Pressable>
          <Pressable
            onPress={capture}
            disabled={!ready || capturing}
            style={({ pressed }) => [styles.shutter, (pressed || capturing) && { transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: !ready || capturing, busy: capturing }}>
            <View style={[styles.shutterInner, !ready && { opacity: 0.5 }]}>
              {capturing && <ActivityIndicator color={colors.primary} />}
            </View>
          </Pressable>
          <View style={styles.sideBtn} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

const C = 34;
const cornerStyle = {
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  preview: { position: 'absolute', backgroundColor: '#000', overflow: 'hidden' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  topTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideArea: { alignItems: 'center', gap: space.md },
  guide: { width: '72%', aspectRatio: 1 },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.accent },
  hint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    marginHorizontal: space.lg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: space.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sideBtn: { width: 72, alignItems: 'center', gap: 4 },
  sideText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  permWrap: { flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
