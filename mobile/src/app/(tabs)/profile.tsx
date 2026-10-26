import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, Card, TextField, type IconName } from '@/components/ui';
import { useProfile } from '@/hooks/useProfile';
import { initials } from '@/lib/format';
import { updateFullName } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, type } from '@/lib/theme';
import { emailToUsername } from '@/lib/validation';

export default function Profile() {
  const { userId, email, fullName, setFullName } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const save = async () => {
    if (!userId) return;
    const name = draft.trim();
    if (name.length < 2) {
      setMessage({ tone: 'error', text: 'Enter your full name.' });
      return;
    }
    setSaving(true);
    try {
      await updateFullName(userId, name);
      setFullName(name);
      setEditing(false);
      setMessage({ tone: 'info', text: 'Your name has been updated.' });
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const signOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to scan and view your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={type.display}>Profile</Text>

        <Card style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName, email)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.title} numberOfLines={1}>
              {fullName || 'Add your name'}
            </Text>
            <Text style={type.muted} numberOfLines={1}>
              {emailToUsername(email)}
            </Text>
          </View>
          {!editing && (
            <Pressable
              onPress={() => {
                setDraft(fullName ?? '');
                setEditing(true);
                setMessage(null);
              }}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit name">
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
          )}
        </Card>

        {editing && (
          <Card style={{ gap: space.md }}>
            <TextField label="Full name" icon="person-outline" value={draft} onChangeText={setDraft} autoFocus autoComplete="name" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        {message && <Banner tone={message.tone} text={message.text} />}

        <Text style={type.overline}>App</Text>
        <Card style={{ padding: 0 }}>
          <Row icon="information-circle-outline" label="About FruitCheck" onPress={() => router.push('/about')} />
          <View style={styles.sep} />
          <Row icon="shield-checkmark-outline" label="Privacy" onPress={() => router.push('/privacy')} />
          <View style={styles.sep} />
          <Row icon="pricetag-outline" label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </Card>

        <Button label="Sign Out" icon="log-out-outline" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mint }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      {value ? <Text style={type.muted}>{value}</Text> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 22 },
  editBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 56, borderRadius: radius.lg },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 },
});
