import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { colors, radius } from '../constants/theme';
import { EmpenhoItem } from '../types';
import { formatarMoeda } from '../lib/format';
import { IconCalendar, IconRight } from './Icons';

interface EmpenhoCardProps {
  item: EmpenhoItem;
  onPress?: (item: EmpenhoItem) => void;
}

export function visualDoEmpenho(item: EmpenhoItem): { bg: string; fg: string; bar: string } {
  if (item.badge === 'blue') return { bg: colors.blueBg, fg: colors.blue, bar: colors.sky };
  if (item.badge === 'amber') return { bg: colors.amberBadgeBg, fg: colors.amberText, bar: colors.amberProgress };
  return { bg: colors.greenBg, fg: colors.greenText, bar: colors.greenProgress };
}

export const EmpenhoCard: React.FC<EmpenhoCardProps> = ({ item, onPress }) => {
  const isRap = item.tipo === 'rap';
  const base = isRap ? item.inscrito || item.value : item.value;
  const liquidado = item.liquidado ?? 0;
  const percentLiquidado = base > 0 ? Math.min(100, Math.round((liquidado / base) * 100)) : 100;
  const visual = visualDoEmpenho(item);
  const saldo = item.saldo ?? item.value;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`Empenho ${item.id}, ${item.name}, ${item.label}. Toque para ver detalhes.`}
    >
      <View style={styles.topRow}>
        <Text style={styles.code}>{item.id}</Text>
        <View style={[styles.badge, { backgroundColor: visual.bg }]}>
          <Text style={[styles.badgeText, { color: visual.fg }]}>{item.label}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>
        {item.desc}
      </Text>

      <View style={styles.valueRow}>
        <View>
          <Text style={styles.valueLabel}>{isRap ? 'Saldo atual' : 'Empenhado'}</Text>
          <Text style={[styles.value, isRap && saldo > 0 && { color: colors.amber }]}>
            {formatarMoeda(isRap ? saldo : item.value, false)}
          </Text>
        </View>
        <View style={styles.valueRight}>
          <Text style={styles.valueLabel}>{isRap ? 'Inscrito' : 'Liquidado'}</Text>
          <Text style={styles.valueSecondary}>{formatarMoeda(isRap ? base : liquidado, false)}</Text>
        </View>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${percentLiquidado}%`, backgroundColor: visual.bar }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barText}>{isRap ? `Liquidado ${formatarMoeda(liquidado, false)}` : `${percentLiquidado}% liquidado`}</Text>
        <Text style={styles.barText}>{isRap ? `${percentLiquidado}% liquidado` : ''}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <IconCalendar size={14} color={colors.mutedText} />
          <Text style={styles.footerText}>{item.date}</Text>
          <Text style={styles.footerDot}>·</Text>
          <Text style={styles.footerText}>
            {isRap ? 'RAP · ' : ''}ND {item.nd}
          </Text>
        </View>
        <IconRight size={15} color={colors.mutedLight} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  code: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2, color: colors.muted },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink, lineHeight: 21 },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, marginBottom: 10 },
  valueRight: { alignItems: 'flex-end' },
  valueLabel: { fontSize: 11.5, color: colors.muted, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, color: colors.ink },
  valueSecondary: { fontSize: 15, fontWeight: '700', color: colors.inkLight },
  barBg: { height: 5, backgroundColor: colors.progressBg, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barText: { fontSize: 11.5, color: colors.muted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: colors.mutedText },
  footerDot: { fontSize: 12, color: colors.mutedExtraLight },
});
