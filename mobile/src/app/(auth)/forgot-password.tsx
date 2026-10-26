import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, type } from '@/lib/theme';
import { authMessage, isEmail } from '@/lib/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (e) setError(authMessage(e.message));
      else setSent(true);
    } catch (e) {
      setError(authMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 6 }}>
        <Text style={type.title}>Forgot your password?</Text>
        <Text style={type.muted}>Enter your account email and we will send you a link to set a new password.</Text>
      </View>
      {error && <Banner tone="error" text={error} />}
      {sent ? (
        <>
          <Banner
            tone="info"
            title="Check your email"
            text={`If an account exists for ${email.trim()}, a password reset link has been sent.`}
          />
          <Button label="Back to Sign In" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <TextField
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={submit}
            error={fieldError}
          />
          <Button label="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
});
