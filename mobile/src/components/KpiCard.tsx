import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';

interface KpiCardProps {
  label: string;
  value: string;
  /** Texto de apoio sob o valor (ex.: "74,9% do planejado"). */
  caption: string;
  /** Percentual da barra (0–100). Omitido = sem barra. */
  progress?: number;
  tone?: string;
  icon?: React.ReactNode;
  /** Quando informado, o cartão vira um botão (abre a tela de detalhe). */
  onPress?: () => void;
}

/** Indicador do painel: rótulo, valor, barra fina de progresso e legenda. */
export const KpiCard: React.FC<KpiCardProps> = ({ label, value, caption, progress, tone = colors.sky, icon, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    disabled={!onPress}
    onPress={onPress}
    activeOpacity={0.8}
    accessible
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}: ${value}. ${caption}${onPress ? '. Toque para ver detalhes.' : ''}`}
  >
    <View style={styles.labelRow}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {icon}
    </View>
    <Text style={[styles.value, { color: tone }]} adjustsFontSizeToFit numberOfLines={1}>
      {value}
    </Text>
    {progress !== undefined ? (
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(Math.max(progress, 0), 100)}%`, backgroundColor: tone }]} />
      </View>
    ) : null}
    <Text style={styles.caption} numberOfLines={1}>
      {caption}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 15,
    gap: 6,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, flexShrink: 1 },
  value: { fontSize: 21, fontWeight: '800', letterSpacing: -0.7 },
  barBg: { height: 4, backgroundColor: colors.progressBg, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  caption: { fontSize: 11.5, color: colors.muted },
});
