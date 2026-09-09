import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import { ContratoItem } from '../types';
import { formatBRL } from '../constants/data';
import {
  IconShield,
  IconBuilding,
  IconDoc,
  IconClock,
} from './Icons';

interface ContratoCardProps {
  item: ContratoItem;
}

export const ContratoCard: React.FC<ContratoCardProps> = ({ item }) => {
  const isTeal = item.icon === 'building';
  const iconBg = isTeal ? colors.tealBg : colors.blueBg;
  const iconColor = isTeal ? colors.tealText : '#4265ba';

  const renderIcon = () => {
    switch (item.icon) {
      case 'shield':
        return <IconShield size={20} color={iconColor} />;
      case 'building':
        return <IconBuilding size={20} color={iconColor} />;
      case 'doc':
      default:
        return <IconDoc size={20} color={iconColor} />;
    }
  };

  const invoiceText =
    item.invoices === 0
      ? 'Sem faturas pendentes'
      : `${item.invoices} fatura${item.invoices > 1 ? 's' : ''} pendente${
          item.invoices > 1 ? 's' : ''
        }`;

  return (
    <View style={styles.card}>
      {/* Head */}
      <View style={styles.headRow}>
        <View style={[styles.categoryIconBox, { backgroundColor: iconBg }]}>
          {renderIcon()}
        </View>
        <View style={styles.headInfo}>
          <Text style={styles.codeText}>{item.id}</Text>
          <Text style={styles.titleText}>{item.title}</Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: item.warning
                ? colors.amberBadgeBg
                : colors.greenBg,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: item.warning ? colors.amberText : colors.greenText,
              },
            ]}
          >
            {item.warning ? 'A vencer' : 'Vigente'}
          </Text>
        </View>
      </View>

      {/* Description / Company */}
      <Text style={styles.companyName}>{item.name}</Text>

      {/* Values */}
      <View style={styles.valuesRow}>
        <View>
          <Text style={styles.valueLabel}>Valor global</Text>
          <Text style={styles.valueNumber}>{formatBRL(item.value)}</Text>
        </View>
        <View style={styles.rightAligned}>
          <Text style={styles.valueLabel}>Empenhado campus</Text>
          <Text style={styles.valueNumber}>{formatBRL(item.campus)}</Text>
        </View>
      </View>

      {/* Progress Bar (vigência) */}
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.min(item.pct, 100)}%`,
              backgroundColor: item.warning
                ? colors.amberProgress
                : colors.blue,
            },
          ]}
        />
      </View>

      {/* Deadline info */}
      <View style={styles.deadlineContainer}>
        <View style={styles.deadlineLeft}>
          <IconClock
            size={14}
            color={item.warning ? colors.amber : colors.muted}
          />
          <Text
            style={[
              styles.deadlineText,
              item.warning && styles.deadlinewarnText,
            ]}
          >
            {item.remaining}
          </Text>
        </View>
        {item.warning ? (
          <Text style={styles.deadlineDate}>{item.end}</Text>
        ) : null}
      </View>

      {/* Tag badges row */}
      <View style={styles.tagRow}>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{item.docs} documentos</Text>
        </View>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{invoiceText}</Text>
        </View>
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
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  categoryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headInfo: {
    flex: 1,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5a6a83',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  companyName: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  valuesRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rightAligned: {
    alignItems: 'flex-end',
  },
  valueLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 5,
  },
  valueNumber: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
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
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 11,
  },
  deadlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    color: colors.muted,
  },
  deadlinewarnText: {
    color: colors.amber,
    fontWeight: '500',
  },
  deadlineDate: {
    fontSize: 12,
    color: colors.amber,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  tagBadge: {
    backgroundColor: colors.tagBg,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 5,
  },
  tagText: {
    fontSize: 12,
    color: colors.tagText,
  },
});
