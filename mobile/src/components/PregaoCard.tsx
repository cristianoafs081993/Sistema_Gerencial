import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../constants/theme';
import { PregaoItem } from '../types';
import { formatBRL } from '../constants/data';
import { IconCalendar, IconGavel } from './Icons';

interface PregaoCardProps {
  item: PregaoItem;
}

export const PregaoCard: React.FC<PregaoCardProps> = ({ item }) => {
  // Proposal badge color
  let badgeBg = '#f1f5f9';
  let badgeText = '#64748b';

  if (item.statusProposta === 'Aberta') {
    badgeBg = colors.greenBg;
    badgeText = colors.greenText;
  } else if (item.statusProposta === 'Futura') {
    badgeBg = '#ecf1ff';
    badgeText = '#4265ba';
  } else if (item.statusProposta === 'Em andamento') {
    badgeBg = colors.amberBadgeBg;
    badgeText = colors.amberText;
  }

  const handleOpenLink = () => {
    if (item.link) {
      Linking.openURL(item.link).catch((err) =>
        console.warn('Erro ao abrir link PNCP:', err)
      );
    }
  };

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.iconBox}>
            <IconGavel size={17} color={colors.blue} />
          </View>
          <View>
            <Text style={styles.codeText}>Pregão {item.numero}</Text>
            <Text style={styles.modalidadeText}>{item.modalidade}</Text>
          </View>
        </View>

        <View style={styles.badgesRow}>
          {item.srp && (
            <View style={styles.srpBadge}>
              <Text style={styles.srpBadgeText}>SRP</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeText }]}>
              {item.statusProposta}
            </Text>
          </View>
        </View>
      </View>

      {/* Objeto */}
      <Text style={styles.objetoText} numberOfLines={3}>
        {item.objeto}
      </Text>

      {/* UASG / Campus */}
      <Text style={styles.uasgText}>
        {item.uasgCodigo} · {item.uasgNome}
      </Text>

      {/* Values Row */}
      <View style={styles.valueRow}>
        <View>
          <Text style={styles.valueText}>{formatBRL(item.valor)}</Text>
          <Text style={styles.valueLabel}>
            {item.tipoValor === 'homologado' ? 'Valor homologado' : 'Valor estimado'}
          </Text>
        </View>

        {item.link ? (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleOpenLink}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>Ver no PNCP ↗</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <IconCalendar size={13} color={colors.mutedText} />
          <Text style={styles.footerText}>
            {item.dataAbertura
              ? `Abertura: ${item.dataAbertura}`
              : `Publicado: ${item.dataPublicacao || 'N/D'}`}
          </Text>
        </View>
        {item.processo ? (
          <Text style={styles.footerRight} numberOfLines={1}>
            Proc: {item.processo}
          </Text>
        ) : null}
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
    marginBottom: 11,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#ecf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 14,
    letterSpacing: -0.2,
    fontWeight: '700',
    color: colors.ink,
  },
  modalidadeText: {
    fontSize: 11,
    color: colors.muted,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  srpBadge: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  srpBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  objetoText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
    marginBottom: 6,
  },
  uasgText: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#f9fbfe',
    borderWidth: 1,
    borderColor: '#edf2f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  valueLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  linkButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#ecf1ff',
  },
  linkButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  footerText: {
    fontSize: 11,
    color: colors.mutedText,
  },
  footerRight: {
    fontSize: 11,
    color: colors.mutedText,
    maxWidth: '45%',
  },
});
