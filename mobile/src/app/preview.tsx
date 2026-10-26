import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button } from '@/components/ui';
import { getPending, pickFromGallery, setPending } from '@/lib/picker';
import { colors, radius, shadow, space, type } from '@/lib/theme';

export default function Preview() {
  const [image, setImage] = useState(getPending());
  const [error, setError] = useState<string | null>(null);

  if (!image) {
    router.replace('/scan');
    return null;
  }

  const chooseAnother = async () => {
    setError(null);
    const r = await pickFromGallery();
    if (r.kind === 'invalid') setError(r.message);
    else if (r.kind === 'ok') {
      setPending(r.image);
      setImage(r.image);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.frame}>
          <Image source={{ uri: image.uri }} style={styles.image} contentFit="contain" accessibilityLabel="Selected fruit photo" />
        </View>
        <Text style={[type.muted, { textAlign: 'center' }]}>
          Make sure a single fruit is clearly visible, centred and in good light.
        </Text>
        {error && <Banner tone="warn" text={error} />}
        <View style={{ gap: space.sm }}>
          <Button label="Classify This Fruit" icon="sparkles" onPress={() => router.replace('/result')} />
          {image.source === 'camera' ? (
            <Button label="Retake Photo" icon="camera-outline" variant="secondary" onPress={() => router.back()} />
          ) : (
            <Button label="Choose Another Photo" icon="images-outline" variant="secondary" onPress={chooseAnother} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  frame: { borderRadius: radius.xl, backgroundColor: colors.card, padding: 6, ...shadow },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: '#EEF2ED' },
});
