import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';

export type EtapaFunil = { label: string; value: number; ratio: number; caption: string; color: string };

/** Funil de execução: quanto do planejado avançou em cada etapa (igual ao web). */
export const FunnelCard: React.FC<{ etapas: EtapaFunil[] }> = ({ etapas }) => (
  <View style={styles.card}>
    {etapas.map((etapa) => (
      <View
        key={etapa.label}
        style={styles.step}
        accessible
        accessibilityLabel={`${etapa.label}: ${formatarMoeda(etapa.value, false)}. ${etapa.caption}`}
      >
        <View style={styles.stepHead}>
          <Text style={styles.stepLabel}>{etapa.label}</Text>
          <Text style={styles.stepValue}>{formatarMoeda(etapa.value, false)}</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.min(Math.max(etapa.ratio, 0), 100)}%`, backgroundColor: etapa.color }]} />
        </View>
        <Text style={styles.caption}>{etapa.caption}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    gap: 16,
  },
  step: { gap: 6 },
  stepHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stepLabel: { fontSize: 14, fontWeight: '800', color: colors.ink },
  stepValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  barBg: { height: 8, backgroundColor: colors.progressBg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  caption: { fontSize: 11.5, color: colors.muted },
});
