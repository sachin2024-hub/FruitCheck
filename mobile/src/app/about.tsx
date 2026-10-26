import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandBlock, TAGLINE } from '@/components/brand';
import { Card } from '@/components/ui';
import { getActiveModel, type ActiveModel } from '@/lib/profile';
import { space, type } from '@/lib/theme';

export default function About() {
  const [model, setModel] = useState<ActiveModel | null>(null);
  useEffect(() => {
    getActiveModel().then(setModel);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.md }}>
        <BrandBlock />
        <Text style={type.muted}>{TAGLINE}</Text>
      </View>
      <Card style={{ gap: space.sm }}>
        <Text style={type.heading}>FruitCheck: An Intelligent Fruit Ripeness Classification System Using Machine Learning</Text>
        <Text style={type.body}>
          FruitCheck classifies photos of apples, bananas and mangoes as ripe or unripe using a convolutional neural
          network based on MobileNetV2. Photos are analysed by the FruitCheck server and results are stored in your
          private account.
        </Text>
      </Card>
      <Card style={{ gap: space.sm }}>
        <Info k="App version" v={Constants.expoConfig?.version ?? '1.0.0'} />
        <Info k="Model" v={model ? `${model.model_name} ${model.version}` : 'Not available'} />
        <Info k="Architecture" v={model?.architecture ?? 'MobileNetV2'} />
        <Info k="Classes" v="Apple, Banana, Mango × Ripe, Unripe" />
      </Card>
      <Text style={type.caption}>
        Results are predictions from a machine learning model and can be wrong. Do not rely on them for food-safety
        decisions.
      </Text>
    </ScrollView>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text style={type.muted}>{k}</Text>
      <Text style={[type.body, { fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
});
