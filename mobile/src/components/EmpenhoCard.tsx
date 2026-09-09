import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import { EmpenhoItem } from '../types';
import { formatBRL } from '../constants/data';
import { IconCalendar } from './Icons';

interface EmpenhoCardProps {
  item: EmpenhoItem;
}

export const EmpenhoCard: React.FC<EmpenhoCardProps> = ({ item }) => {
  const percentPaid = Math.round((item.paid / item.value) * 100);

  // Badge colors
  let badgeBg = colors.greenBg;
  let badgeText = colors.greenText;
  if (item.badge === 'blue') {
    badgeBg = '#ecf1ff';
    badgeText = '#4265ba';
  } else if (item.badge === 'amber') {
    badgeBg = colors.amberBadgeBg;
    badgeText = colors.amberText;
  }

  const progressBarColor =
    item.status === 'pago' ? colors.greenProgress : colors.blue;

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <Text style={styles.codeText}>{item.id}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeText }]}>
            {item.label}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.desc}>{item.desc}</Text>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={styles.valueText}>{formatBRL(item.value)}</Text>
        <Text style={styles.valueLabel}>Empenhado</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.min(percentPaid, 100)}%`,
              backgroundColor: progressBarColor,
            },
          ]}
        />
      </View>

      {/* Progress Label */}
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabelLeft}>
          Pago {formatBRL(item.paid)}
        </Text>
        <Text style={styles.progressLabelRight}>{percentPaid}%</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <IconCalendar size={14} color={colors.mutedText} />
          <Text style={styles.footerText}>{item.date}</Text>
        </View>
        <Text style={styles.footerRight}>
          {item.tipo === 'rap' ? 'RAP · ' : ''}ND {item.nd}
        </Text>
      </View>
    </View>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  codeText: {
    fontSize: 12,
    letterSpacing: 0.4,
    fontWeight: '700',
    color: '#5a6a83',
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: 4,
    lineHeight: 22,
  },
  desc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 17,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  valueLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: colors.progressBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabelLeft: {
    fontSize: 12,
    color: colors.muted,
  },
  progressLabelRight: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4262a1',
  },
  footer: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  footerRight: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '500',
  },
});
