import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';

/** Erro de carregamento com ação de repetir (nunca mostramos dados de demonstração). */
export const ErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <View style={styles.errorCard} accessibilityLiveRegion="polite">
    <Text style={styles.errorTitle}>Não foi possível carregar</Text>
    <Text style={styles.errorDesc}>{message}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
      <Text style={styles.retryText}>Tentar novamente</Text>
    </TouchableOpacity>
  </View>
);

export const EmptyCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyDesc}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  errorCard: { backgroundColor: colors.dangerBg, borderRadius: 16, padding: 18, gap: 8, alignItems: 'flex-start' },
  errorTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  errorDesc: { fontSize: 13, lineHeight: 19, color: colors.inkLight },
  retryButton: { marginTop: 6, backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mutedExtraLight,
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
