import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EnergiaFaturaItem, EnergiaSolarItem } from '../types';
import { colors } from '../constants/theme';
import { formatBRL } from '../constants/data';
import { IconZap, IconReceipt } from './Icons';

interface EnergiaCardProps {
  type: 'fatura' | 'solar';
  fatura?: EnergiaFaturaItem;
  solar?: EnergiaSolarItem;
}

export const EnergiaCard: React.FC<EnergiaCardProps> = ({ type, fatura, solar }) => {
  if (type === 'solar' && solar) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {solar.ufvNome}
            </Text>
            <Text style={styles.subtitle}>
              Referência: {solar.mes ? `${String(solar.mes).padStart(2, '0')}/${solar.ano}` : solar.dataReferencia}
            </Text>
          </View>

          <View style={[styles.fonteBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
            <IconZap size={12} color="#b45309" strokeWidth={2} />
            <Text style={[styles.fonteText, { color: '#b45309' }]}>Solar Fotovoltaica</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Geração no Período</Text>
            <Text style={[styles.metricValue, { color: '#b45309' }]}>
              {solar.energiaGeradaKwh.toLocaleString('pt-BR')} kWh
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (type === 'fatura' && fatura) {
    const isMercatto = fatura.fonte === 'mercatto';
    const badgeColor = isMercatto ? '#1d4ed8' : '#047857';
    const badgeBg = isMercatto ? '#eff6ff' : '#ecfdf5';
    const badgeBorder = isMercatto ? '#bfdbfe' : '#a7f3d0';

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              Competência {fatura.competencia}
            </Text>
            <Text style={styles.subtitle}>
              {fatura.fornecedor || (isMercatto ? 'Mercatto Energia' : 'Neoenergia Cosern')}
              {fatura.faturaNumero ? ` • Nº ${fatura.faturaNumero}` : ''}
            </Text>
          </View>

          <View style={[styles.fonteBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Text style={[styles.fonteText, { color: badgeColor }]}>
              {isMercatto ? 'Mercatto' : 'COSERN'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Consumo Faturado</Text>
            <Text style={styles.metricValue}>
              {fatura.consumoKwh.toLocaleString('pt-BR')} kWh
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Valor da Fatura</Text>
            <Text style={[styles.metricValue, { color: colors.blue }]}>
              {formatBRL(fatura.valor)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  fonteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  fonteText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 3,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
});
