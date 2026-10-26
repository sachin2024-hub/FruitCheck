import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { FRUIT_PHOTOS } from '@/lib/labels';
import { markOnboardingSeen } from '@/lib/onboarding';
import { colors, radius, space, type } from '@/lib/theme';

const SLIDES: { title: string; text: string; icon: IconName; photo: ImageSourcePropType }[] = [
  {
    title: 'Scan any apple, banana or mango',
    text: 'Point your camera at a single fruit and FruitCheck classifies it as ripe or unripe.',
    icon: 'scan',
    photo: FRUIT_PHOTOS['apple-ripe'],
  },
  {
    title: 'Use the camera or your gallery',
    text: 'Take a new photo or upload one you already have. You can preview it before it is analysed.',
    icon: 'images',
    photo: FRUIT_PHOTOS['banana-unripe'],
  },
  {
    title: 'See the result and its confidence',
    text: 'Each result shows the model’s confidence, and your scans are saved privately to your history.',
    icon: 'stats-chart',
    photo: FRUIT_PHOTOS['mango-ripe'],
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await markOnboardingSeen();
    router.replace(session ? '/home' : '/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <Text style={type.overline}>
          {index + 1} / {SLIDES.length}
        </Text>
        {!last && (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.photoWrap}>
              <Image source={item.photo} style={styles.photo} contentFit="cover" />
              <View style={styles.iconBubble}>
                <Ionicons name={item.icon} size={26} color="#fff" />
              </View>
            </View>
            <Text style={[type.display, { textAlign: 'center' }]}>{item.title}</Text>
            <Text style={[type.muted, { textAlign: 'center', fontSize: 16, lineHeight: 24 }]}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          label={last ? 'Get Started' : 'Next'}
          icon={last ? 'arrow-forward' : undefined}
          onPress={() => (last ? finish() : list.current?.scrollToIndex({ index: index + 1 }))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  skip: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  slide: { paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', gap: space.md },
  photoWrap: { marginBottom: space.lg },
  photo: { width: 230, height: 230, borderRadius: 115, borderWidth: 8, borderColor: colors.mint },
  iconBubble: {
    position: 'absolute',
    right: 6,
    bottom: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  bottom: { padding: space.lg, gap: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
});
