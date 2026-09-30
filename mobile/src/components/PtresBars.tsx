import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';
import type { ResumoPtres } from '../lib/orcamentoRules';

interface PtresBarsProps {
  dados: ResumoPtres[];
  /** Nomes conhecidos por código (ex.: "PROAD · Gestão Administrativa"). */
  nomes?: Record<string, string>;
  tone?: string;
  selecionado?: string;
  onSelect?: (ptres: string) => void;
}

/** Barras horizontais de valor por PTRES. Toque numa barra para filtrar por aquele PTRES. */
export const PtresBars: React.FC<PtresBarsProps> = ({ dados, nomes = {}, tone = '#1E88E5', selecionado, onSelect }) => {
  const positivos = dados.filter((d) => d.valor > 0);
  const maximo = Math.max(1, ...positivos.map((d) => d.valor));
  if (positivos.length === 0) return null;

  return (
    <View style={styles.card}>
      {positivos.map((item) => {
        const ativo = selecionado === item.ptres;
        return (
          <TouchableOpacity
            key={item.ptres}
            style={[styles.row, ativo && styles.rowActive]}
            activeOpacity={0.7}
            onPress={() => onSelect?.(item.ptres)}
            disabled={!onSelect}
            accessibilityRole="button"
            accessibilityLabel={`PTRES ${item.ptres}: ${formatarMoeda(item.valor, false)}`}
            accessibilityState={{ selected: ativo }}
          >
            <View style={styles.head}>
              <Text style={styles.code}>{item.ptres}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {nomes[item.ptres] ?? ''}
              </Text>
              <Text style={styles.value}>{formatarMoeda(item.valor, false)}</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(item.valor / maximo) * 100}%`, backgroundColor: tone }]} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 8,
  },
  row: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: radius.sm, gap: 6 },
  rowActive: { backgroundColor: colors.blueBg },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  code: { fontSize: 13, fontWeight: '800', color: colors.ink },
  name: { flex: 1, fontSize: 12, color: colors.muted },
  value: { fontSize: 13, fontWeight: '800', color: colors.ink },
  barBg: { height: 6, backgroundColor: colors.progressBg, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
