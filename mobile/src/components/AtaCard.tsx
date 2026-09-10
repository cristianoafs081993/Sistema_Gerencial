import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import { AtaItem } from '../types';
import { IconCalendar, IconDoc } from './Icons';

interface AtaCardProps {
  item: AtaItem;
}

export const AtaCard: React.FC<AtaCardProps> = ({ item }) => {
  // Vigência badge colors
  let vigenciaBg = colors.greenBg;
  let vigenciaText = colors.greenText;
  let vigenciaLabel = `Vigente · ${item.diasRestantes} dias`;

  if (item.statusVigencia === 'vencer') {
    vigenciaBg = colors.amberBadgeBg;
    vigenciaText = colors.amberText;
    vigenciaLabel = `Vence em ${item.diasRestantes} dias`;
  } else if (item.statusVigencia === 'expirada') {
    vigenciaBg = '#f1f5f9';
    vigenciaText = '#64748b';
    vigenciaLabel = 'Expirada';
  }

  // Vínculo badge
  let vinculoBg = '#ecf1ff';
  let vinculoText = colors.blue;
  let vinculoLabel = 'Gerenciadora';

  if (item.vinculo === 'participante') {
    vinculoBg = '#ecfdf5';
    vinculoText = '#047857';
    vinculoLabel = 'Participante';
  } else if (item.vinculo === 'aderente') {
    vinculoBg = '#faf5ff';
    vinculoText = '#7e22ce';
    vinculoLabel = 'Aderente (Carona)';
  } else if (item.vinculo === 'outro') {
    vinculoBg = '#f8fafc';
    vinculoText = '#64748b';
    vinculoLabel = 'Outra unidade';
  }

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.iconBox}>
            <IconDoc size={17} color={colors.blue} />
          </View>
          <View>
            <Text style={styles.codeText}>Ata {item.numeroAta}</Text>
            {item.numeroCompra ? (
              <Text style={styles.compraText}>Pregão {item.numeroCompra}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: vinculoBg }]}>
            <Text style={[styles.badgeText, { color: vinculoText }]}>
              {vinculoLabel}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: vigenciaBg }]}>
            <Text style={[styles.badgeText, { color: vigenciaText }]}>
              {vigenciaLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Objeto */}
      <Text style={styles.objetoText} numberOfLines={3}>
        {item.objeto}
      </Text>

      {/* Gerenciadora */}
      <Text style={styles.gerenciadoraText}>
        UG: {item.unidadeGerenciadoraCodigo} · {item.unidadeGerenciadoraNome}
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalItens}</Text>
          <Text style={styles.statLabel}>Itens registrados</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalAdesoes}</Text>
          <Text style={styles.statLabel}>Adesões autorizadas</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <IconCalendar size={13} color={colors.mutedText} />
          <Text style={styles.footerText}>
            Vigência: {item.vigenciaInicio} a {item.vigenciaFim}
          </Text>
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
  compraText: {
    fontSize: 11,
    color: colors.muted,
  },
  badgesRow: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  objetoText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
    marginBottom: 6,
  },
  gerenciadoraText: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fbfe',
    borderWidth: 1,
    borderColor: '#edf2f9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
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
});
