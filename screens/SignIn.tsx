import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../lib/auth';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
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
      mode === 'in' ? await signIn(email, password) : await signUp(email, password, displayName || email.split('@')[0]);
    if (result.error) setErr(result.error);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Run-It</Text>
      <Text style={styles.subtitle}>{mode === 'in' ? 'Sign in to claim regions' : 'Create your account'}</Text>

      {mode === 'up' && (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor="#7790aa"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#7790aa"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#7790aa"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
      />

      {err && <Text style={styles.err}>{err}</Text>}

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{mode === 'in' ? 'Sign in' : 'Sign up'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
        <Text style={styles.switch}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a2b', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#7790aa', fontSize: 15, marginBottom: 32 },
  input: { backgroundColor: '#16263a', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#3aa0ff', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switch: { color: '#7790aa', textAlign: 'center', marginTop: 20 },
  err: { color: '#ff8b8b', marginBottom: 8 },
});
