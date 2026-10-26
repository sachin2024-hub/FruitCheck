import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo, Wordmark } from '@/components/brand';
import { Banner, Button, ScreenBackground, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, space, type } from '@/lib/theme';
import { authMessage, isUsername, usernameToEmail } from '@/lib/validation';

export default function Login() {
  const params = useLocalSearchParams<{ notice?: string }>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!isUsername(username)) next.username = 'Enter your username.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (e) setError(authMessage(e.message));
      // On success the session changes and the navigator moves to the app.
    } catch (e) {
      setError(authMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Logo size={72} />
            <Wordmark />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={type.display}>Welcome back</Text>
            <Text style={type.muted}>Sign in to scan fruit and keep your classification history.</Text>
          </View>

          {params.notice && <Banner tone="info" text={params.notice} />}
          {error && <Banner tone="error" text={error} />}

          <TextField
            label="Username"
            icon="at-outline"
            placeholder="Your username"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />
          <TextField
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            secure
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            error={errors.password}
          />
          <Button label="Sign In" onPress={submit} loading={busy} />

          <View style={styles.switch}>
            <Text style={type.muted}>New to FruitCheck?</Text>
            <Pressable onPress={() => router.push('/register')} hitSlop={8}>
              <Text style={styles.link}>Create Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  switch: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
});
