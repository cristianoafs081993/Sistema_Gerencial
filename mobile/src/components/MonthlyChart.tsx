import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { formatarMoeda, formatarMoedaCompacta } from '../lib/format';
import type { SerieMensal } from '../lib/dashboardRules';

const ALTURA = 120;
const LARGURA_MES = 54;

/** Barras mensais de empenhado e liquidado. Toque em um mês para ver os valores exatos. */
export const MonthlyChart: React.FC<{ dados: SerieMensal[] }> = ({ dados }) => {
  // Começa no último mês com movimento (o mês corrente pode ainda não ter empenhos).
  const [selecionado, setSelecionado] = useState<number | null>(() => {
    for (let i = dados.length - 1; i >= 0; i--) {
      if (dados[i].empenhado > 0 || dados[i].liquidado > 0) return i;
    }
    return dados.length ? dados.length - 1 : null;
  });
  const maximo = Math.max(1, ...dados.flatMap((m) => [m.empenhado, m.liquidado]));
  const escolhido = selecionado !== null ? dados[selecionado] : null;

  if (dados.every((m) => m.empenhado === 0 && m.liquidado === 0)) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>Ainda não há empenhos no exercício para exibir por mês.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.sky }]} />
          <Text style={styles.legendText}>Empenhado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.cyan }]} />
          <Text style={styles.legendText}>Liquidado</Text>
        </View>
      </View>

      <View style={styles.tooltip} accessibilityLiveRegion="polite">
        {escolhido ? (
          <Text style={styles.tooltipText}>
            <Text style={styles.tooltipStrong}>{escolhido.mes}</Text>
            {'  ·  Empenhado '}
            <Text style={styles.tooltipStrong}>{formatarMoeda(escolhido.empenhado, false)}</Text>
            {'  ·  Liquidado '}
            <Text style={styles.tooltipStrong}>{formatarMoeda(escolhido.liquidado, false)}</Text>
          </Text>
        ) : (
          <Text style={styles.tooltipText}>Toque em um mês para ver os valores.</Text>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {dados.map((mes, index) => {
          const ativo = selecionado === index;
          return (
            <TouchableOpacity
              key={mes.mes}
              style={[styles.column, { width: LARGURA_MES }, ativo && styles.columnActive]}
              onPress={() => setSelecionado(index)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${mes.mes}: empenhado ${formatarMoeda(mes.empenhado, false)}, liquidado ${formatarMoeda(mes.liquidado, false)}`}
            >
              <Text style={styles.topValue} numberOfLines={1}>
                {mes.empenhado > 0 ? formatarMoedaCompacta(mes.empenhado).replace('R$ ', '') : ''}
              </Text>
              <View style={styles.bars}>
                <View style={[styles.bar, { height: Math.max(3, (mes.empenhado / maximo) * ALTURA), backgroundColor: colors.sky }]} />
                <View style={[styles.bar, { height: Math.max(3, (mes.liquidado / maximo) * ALTURA), backgroundColor: colors.cyan }]} />
              </View>
              <Text style={[styles.month, ativo && styles.monthActive]}>{mes.mes}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 14,
    gap: 10,
  },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', padding: 18 },
  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  tooltip: {
    minHeight: 34,
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  tooltipText: { fontSize: 12, color: colors.muted },
  tooltipStrong: { fontWeight: '800', color: colors.ink },
  scroll: { paddingHorizontal: 10, alignItems: 'flex-end' },
  column: { alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: radius.sm },
  columnActive: { backgroundColor: colors.blueBg },
  topValue: { fontSize: 10, fontWeight: '700', color: colors.mutedText, height: 13 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: ALTURA },
  bar: { width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  month: { fontSize: 11.5, fontWeight: '700', color: colors.mutedText },
  monthActive: { color: colors.blue },
});
