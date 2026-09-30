import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius } from '../constants/theme';
import type { ContratoItem, ContratoStatus } from '../types';
import { formatarMoeda, formatarDataIso } from '../lib/format';
import { IconShield, IconBuilding, IconDoc, IconClock } from './Icons';

interface ContratoCardProps {
  item: ContratoItem;
  onPress?: (item: ContratoItem) => void;
}

const STATUS_VISUAL: Record<ContratoStatus, { label: string; bg: string; fg: string; bar: string }> = {
  vigente: { label: 'Vigente', bg: colors.greenBg, fg: colors.greenText, bar: colors.sky },
  a_vencer: { label: 'A vencer', bg: colors.amberBadgeBg, fg: colors.amberText, bar: colors.amberProgress },
  expirado: { label: 'Expirado', bg: colors.dangerBg, fg: colors.danger, bar: colors.mutedExtraLight },
};

export const ContratoCard: React.FC<ContratoCardProps> = ({ item, onPress }) => {
  const visual = STATUS_VISUAL[item.status];
  const isTeal = item.icon === 'building';
  const iconBg = isTeal ? colors.tealBg : colors.blueBg;
  const iconColor = isTeal ? colors.tealText : colors.blue;

  const renderIcon = () => {
    if (item.icon === 'shield') return <IconShield size={20} color={iconColor} />;
    if (item.icon === 'building') return <IconBuilding size={20} color={iconColor} />;
    return <IconDoc size={20} color={iconColor} />;
  };

  const faturasTexto = `${item.faturasPendentes} ${item.faturasPendentes === 1 ? 'fatura pendente' : 'faturas pendentes'}`;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`Contrato ${item.numero}, ${item.fornecedor}. ${visual.label}. Toque para ver detalhes.`}
    >
      <View style={styles.headRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>{renderIcon()}</View>
        <View style={styles.headInfo}>
          <Text style={styles.codeText}>Contrato {item.numero}</Text>
          <Text style={styles.titleText} numberOfLines={2}>
            {item.fornecedor}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: visual.bg }]}>
          <Text style={[styles.badgeText, { color: visual.fg }]}>{visual.label}</Text>
        </View>
      </View>

      <Text style={styles.objeto} numberOfLines={2}>
        {item.objeto}
      </Text>

      <View style={styles.valuesRow}>
        <View>
          <Text style={styles.valueLabel}>Valor global</Text>
          <Text style={styles.valueNumber}>{formatarMoeda(item.valorGlobal, false)}</Text>
        </View>
        <View style={styles.rightAligned}>
          <Text style={styles.valueLabel}>Empenhado no campus</Text>
          <Text style={styles.valueNumber}>{formatarMoeda(item.empenhado, false)}</Text>
        </View>
      </View>

      <View style={styles.progressBg}>
        <View
          style={[styles.progressFill, { width: `${Math.min(item.percentualDecorrido, 100)}%`, backgroundColor: visual.bar }]}
        />
      </View>

      <View style={styles.deadlineRow}>
        <View style={styles.deadlineLeft}>
          <IconClock size={14} color={item.status === 'a_vencer' ? colors.amber : colors.muted} />
          <Text style={[styles.deadlineText, item.status === 'a_vencer' && styles.deadlineWarn]}>{item.vigenciaTexto}</Text>
        </View>
        <Text style={styles.deadlineDate}>até {formatarDataIso(item.vigenciaFim)}</Text>
      </View>

      {item.faturasPendentes > 0 ? (
        <View style={styles.tagRow}>
          <View style={styles.tagWarn}>
            <Text style={styles.tagWarnText}>{faturasTexto}</Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headInfo: { flex: 1 },
  codeText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  titleText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink, marginTop: 2 },
  badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  objeto: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  valuesRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  rightAligned: { alignItems: 'flex-end' },
  valueLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  valueNumber: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  progressBg: { height: 5, backgroundColor: colors.progressBg, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  deadlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  deadlineText: { fontSize: 12, color: colors.muted },
  deadlineWarn: { color: colors.amber, fontWeight: '700' },
  deadlineDate: { fontSize: 12, color: colors.mutedText },
  tagRow: { flexDirection: 'row', marginTop: 12 },
  tagWarn: { backgroundColor: colors.amberBadgeBg, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill },
  tagWarnText: { fontSize: 12, fontWeight: '700', color: colors.amberText },
});
