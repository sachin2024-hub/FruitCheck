import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui';
import { space, type } from '@/lib/theme';

const SECTIONS: [string, string][] = [
  [
    'Your account',
    'You sign in with your username and password through Supabase Authentication. FruitCheck stores your name and username to identify your account.',
  ],
  [
    'Your photos',
    'Photos you classify are sent to the FruitCheck server for analysis and a copy is stored in a private storage folder that only your account can access. Photos are never public.',
  ],
  [
    'Your results',
    'Each scan saves the predicted fruit, ripeness, confidence, image source, model version and date. Database rules ensure you can only read or delete your own records.',
  ],
  [
    'Deleting data',
    'You can delete any scan from its detail screen. This removes the record and its stored photo.',
  ],
  ['Camera', 'The camera is used only while you are on the Scan screen, to take the photo you choose to classify.'],
];

export default function Privacy() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {SECTIONS.map(([title, text]) => (
        <Card key={title} style={{ gap: 6 }}>
          <Text style={type.heading}>{title}</Text>
          <Text style={type.body}>{text}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
});
