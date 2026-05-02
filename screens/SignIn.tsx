import { useState } from 'react';
import { Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../lib/auth';
import { palette as P } from '../lib/ui';
import { PrimaryButton, SecondaryButton } from '../lib/ui/components';

export default function SignIn() {
  const { signIn, signUp, startPreview } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const result =
      mode === 'in'
        ? await signIn(email, password)
        : await signUp(email, password, displayName || email.split('@')[0]);
    if (result.error) setErr(result.error);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.wordmark}>RUN-IT</Text>
      <Text style={styles.subtitle}>
        {mode === 'in' ? 'Sign in to claim regions' : 'Create your account'}
      </Text>

      {mode === 'up' && (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={P.parchmentMid}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={P.parchmentMid}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={P.parchmentMid}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
      />

      {err && <Text style={styles.err}>{err}</Text>}

      <PrimaryButton
        label={mode === 'in' ? 'Sign in' : 'Sign up'}
        onPress={submit}
        loading={busy}
        style={{ marginTop: 8, marginBottom: 10 }}
      />

      <SecondaryButton
        label={mode === 'in' ? 'New here? Create account' : 'Have account? Sign in'}
        onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
      />

      {Platform.OS === 'web' && (
        <SecondaryButton label="Preview app UI" onPress={startPreview} style={{ marginTop: 10 }} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.parchment, padding: 28, justifyContent: 'center' },
  wordmark: {
    fontFamily: 'BebasNeue',
    color: P.ink,
    fontSize: 56,
    letterSpacing: 4,
    marginBottom: 4,
  },
  subtitle: { fontFamily: 'Inter', color: P.parchmentMid, fontSize: 15, marginBottom: 32 },
  input: {
    backgroundColor: P.landFill,
    color: P.parchmentInk,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: 'Inter',
    borderWidth: 1.5,
    borderColor: P.landEdge,
  },
  err: { fontFamily: 'Inter', color: P.red, marginBottom: 8, fontSize: 13 },
});
