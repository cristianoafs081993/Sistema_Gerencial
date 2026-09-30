import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import { BrandLogo } from '../components/BrandLogo';

type Props =
  | { kind: 'loading'; message: string }
  | { kind: 'denied'; email?: string | null; onSignOut: () => void; terceirizado?: boolean }
  | { kind: 'error'; message: string; onRetry: () => void; onSignOut: () => void };

/** Telas de estado da autenticação: carregando, sem acesso ao app ou erro ao carregar permissões. */
export const AccessStateScreen: React.FC<Props> = (props) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <BrandLogo size={props.kind === 'loading' ? 72 : 56} />
        {props.kind === 'loading' ? (
          <>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {props.message}
            </Text>
          </>
        ) : null}

        {props.kind === 'denied' ? (
          <>
            <Text style={styles.title}>Sem acesso ao app</Text>
            <Text style={styles.message}>
              {props.terceirizado
                ? 'Usuários terceirizados ainda não têm acesso ao aplicativo. Use o sistema web.'
                : 'Seu usuário não tem permissão para Orçamento nem Contratos. Peça liberação ao administrador do seu órgão.'}
            </Text>
            {props.email ? <Text style={styles.email}>{props.email}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={props.onSignOut} accessibilityRole="button">
              <Text style={styles.buttonText}>Sair</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {props.kind === 'error' ? (
          <>
            <Text style={styles.title}>Não foi possível continuar</Text>
            <Text style={styles.message}>{props.message}</Text>
            <TouchableOpacity style={styles.button} onPress={props.onRetry} accessibilityRole="button">
              <Text style={styles.buttonText}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.link} onPress={props.onSignOut} accessibilityRole="button">
              <Text style={styles.linkText}>Sair</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
  message: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  email: { fontSize: 13, fontWeight: '700', color: colors.inkLight },
  button: {
    marginTop: 8,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '800', color: colors.white },
  link: { paddingVertical: 8, paddingHorizontal: 16 },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.blue },
});
