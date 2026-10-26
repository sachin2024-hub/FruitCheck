import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Logo, TAGLINE, Wordmark } from '@/components/brand';
import { ScreenBackground } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { colors } from '@/lib/theme';

// The branded splash is shown in full only on cold start; later auth changes pass through quickly.
let coldStart = true;

export default function Splash() {
  const { session, loading } = useAuth();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const started = Date.now();
    (async () => {
      const seen = await hasSeenOnboarding();
      const wait = coldStart ? Math.max(0, 1400 - (Date.now() - started)) : 0;
      coldStart = false;
      setTimeout(() => {
        if (cancelled) return;
        if (!seen) router.replace('/onboarding');
        else router.replace(session ? '/home' : '/login');
      }, wait);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <StatusBar style="dark" />
        <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center', gap: 14 }}>
          <View style={styles.logoRing}>
            <Logo size={72} />
          </View>
          <Wordmark size={34} />
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(250).duration(500)} style={styles.basket} accessibilityElementsHidden>
          <Text style={styles.fruits}>🍎🍌🥭</Text>
          <Text style={styles.basketEmoji}>🧺</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(400)} style={styles.footer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.footerText}>Intelligent fruit ripeness classification</Text>
        </Animated.View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoRing: { padding: 14, borderRadius: 36, backgroundColor: colors.primary },
  tagline: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  basket: { alignItems: 'center', marginTop: 28 },
  fruits: { fontSize: 56, lineHeight: 64, marginBottom: -34, zIndex: 0 },
  basketEmoji: { fontSize: 110, lineHeight: 124, zIndex: 1 },
  footer: { position: 'absolute', bottom: 56, alignItems: 'center', gap: 10 },
  footerText: { color: colors.muted, fontSize: 13 },
});
