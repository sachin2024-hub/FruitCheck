import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export const TAGLINE = 'Know Your Fruit. Know Its Ripeness.';

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size }}
      accessibilityLabel="FruitCheck logo"
    />
  );
}

export function Wordmark({ light, size = 30 }: { light?: boolean; size?: number }) {
  return (
    <Text style={[styles.word, { fontSize: size, color: light ? '#fff' : colors.text }]}>
      Fruit<Text style={{ color: light ? colors.accent : colors.primary }}>Check</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  word: { fontWeight: '800', letterSpacing: -0.5 },
});

export function BrandBlock({ light }: { light?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Logo size={84} />
      <Wordmark light={light} />
    </View>
  );
}
