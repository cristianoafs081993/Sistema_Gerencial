import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import { IconChart } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const message = await signIn(email, password);
    if (message) {
      setError(message);
      setSubmitting(false);
    }
    // Em caso de sucesso o AuthProvider troca a tela; não há mais nada a fazer aqui.
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.brandmark}>
              <IconChart size={26} color={colors.white} />
            </View>
            <Text style={styles.brandText}>
              siages<Text style={styles.brandDot}>.</Text>
            </Text>
            <Text style={styles.tagline}>Orçamento e contratos do seu campus, no bolso.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>Use o mesmo e-mail e senha do sistema SIAGES.</Text>

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@ifrn.edu.br"
              placeholderTextColor={colors.mutedLight}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!submitting}
              accessibilityLabel="E-mail"
            />

            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Sua senha"
                placeholderTextColor={colors.mutedLight}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                editable={!submitting}
                accessibilityLabel="Senha"
              />
              <TouchableOpacity
                style={styles.toggle}
                onPress={() => setShowPassword((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Esqueceu a senha? Peça a redefinição no sistema web ou ao administrador do seu órgão.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 },
  brand: { alignItems: 'center', gap: 8 },
  brandmark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2, color: colors.ink },
  brandDot: { color: colors.cyan },
  tagline: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 6,
    boxShadow: '0 8px 24px -12px rgba(30, 80, 140, 0.25)',
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkLight, marginTop: 8, marginBottom: 4 },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineInput,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 84 },
  toggle: { position: 'absolute', right: 6, height: 40, paddingHorizontal: 10, justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.blue },
  errorBox: {
    marginTop: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  button: {
    marginTop: 16,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '800', color: colors.white },
  footer: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingHorizontal: 12 },
});
