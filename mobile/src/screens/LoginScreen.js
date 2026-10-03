import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { Button, Field, ErrorText } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { API_URL } from '../config';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.phone.trim(), form.password);
      } else {
        await register(form.name.trim(), form.phone.trim(), form.password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>K</Text>
          </View>
          <Text style={styles.title}>Karmamitra</Text>
          <Text style={styles.subtitle}>Attendance, wages &amp; weekly payments</Text>
        </View>

        <View style={styles.card}>
          {mode === 'register' && (
            <Field
              label="Your name"
              value={form.name}
              onChangeText={set('name')}
              placeholder="e.g. Ramesh"
            />
          )}
          <Field
            label="Phone number"
            value={form.phone}
            onChangeText={set('phone')}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
          />

          <ErrorText>{error}</ErrorText>

          <Button
            title={busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
            onPress={submit}
            disabled={busy}
          />

          <Pressable
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            style={styles.switch}
          >
            <Text style={styles.switchText}>
              {mode === 'login'
                ? 'New here? Create an account'
                : 'Already have an account? Log in'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Demo: 9999999999 / admin123{'\n'}
          API: {API_URL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.primary },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  markText: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  title: { color: colors.white, fontSize: 28, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl },
  switch: { marginTop: spacing.md, alignItems: 'center' },
  switchText: { color: colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginTop: spacing.lg },
});