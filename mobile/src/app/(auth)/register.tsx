import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, type } from '@/lib/theme';
import { authMessage, isUsername, passwordStrength, usernameToEmail } from '@/lib/validation';

type Errors = Partial<Record<'name' | 'username' | 'password' | 'confirm', string>>;

export default function Register() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);
  const scroll = useRef<ScrollView>(null);
  // Wait for the keyboard to finish resizing the layout, then reveal the focused field and the button below it.
  const revealBottom = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);

  const submit = async () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!isUsername(username)) next.username = '3-20 characters: letters, numbers, dot or underscore.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    else if (strength.score < 2) next.password = `Make it stronger: add ${strength.tips.join(', ')}.`;
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email: usernameToEmail(username),
        password,
        options: { data: { full_name: name.trim() } }, // copied into public.profiles by a trigger
      });
      if (e) setError(authMessage(e.message));
      else {
        // Sign up opens a session; end it so the user signs in themselves on the login screen.
        if (data.session) await supabase.auth.signOut();
        router.replace({
          pathname: '/login',
          params: { notice: 'Account created. Please sign in.' },
        });
      }
    } catch (e) {
      setError(authMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const meterColor = [colors.danger, colors.danger, colors.accent, colors.primary, colors.primary][strength.score];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={type.display}>Join FruitCheck</Text>
          <Text style={type.muted}>Create an account to classify fruit and save your results privately.</Text>
        </View>

        {error && <Banner tone="error" text={error} />}

        <TextField
          label="Full name"
          icon="person-outline"
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        <TextField
          label="Username"
          icon="at-outline"
          placeholder="juandelacruz"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          value={username}
          onChangeText={setUsername}
          error={errors.username}
        />
        <TextField
          label="Password"
          icon="lock-closed-outline"
          placeholder="At least 8 characters"
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          onFocus={revealBottom}
          error={errors.password}
        />
        {password.length > 0 && (
          <View style={{ gap: 6 }} accessibilityLabel={`Password strength: ${strength.label}`}>
            <View style={styles.meter}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.meterSeg, i <= strength.score && { backgroundColor: meterColor }]} />
              ))}
            </View>
            <Text style={type.caption}>
              {strength.label}
              {strength.tips.length ? ` · Add ${strength.tips.join(', ')}` : ''}
            </Text>
          </View>
        )}
        <TextField
          label="Confirm password"
          icon="lock-closed-outline"
          placeholder="Re-enter your password"
          secure
          autoComplete="new-password"
          value={confirm}
          onChangeText={setConfirm}
          onFocus={revealBottom}
          onSubmitEditing={submit}
          error={errors.confirm}
        />

        <Button label="Create Account" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />

        <View style={styles.switch}>
          <Text style={type.muted}>Already have an account?</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  meter: { flexDirection: 'row', gap: 6 },
  meterSeg: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  switch: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
