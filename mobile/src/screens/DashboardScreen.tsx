import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/theme';
import { formatBRL } from '../constants/data';
import {
  IconCalendar,
  IconWallet,
  IconDoc,
  IconLayers,
  IconCheck,
  IconClock,
  IconRight,
} from '../components/Icons';
import { DonutChart } from '../components/DonutChart';
import { ExecutionChart } from '../components/ExecutionChart';
import {
  fetchDashboardMetrics,
  DashboardMetricsResult,
} from '../services/api';

interface DashboardScreenProps {
  onNavigateToContratosAlert: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToContratosAlert,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Conectando ao backend e sincronizando dados...</Text>
      </View>
    );
  }

  const current = metrics!;
  const alertCount = current.contratosAVencerCount || 1;
  const alertTitle =
    alertCount === 1
      ? 'Um contrato merece atenção'
      : `${alertCount} contratos merecem atenção`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          colors={[colors.blue]}
          tintColor={colors.blue}
        />
      }
    >
      {/* Greeting */}
      <Text style={styles.greeting}>Olá, {current.usuario}</Text>

      {/* Title Row */}
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>Visão geral</Text>
        <View style={styles.yearBadge}>
          <IconCalendar size={14} color="#51627b" />
          <Text style={styles.yearText}>{current.exercicio}</Text>
        </View>
      </View>

      {/* Planejado Hero Card (Gradient) */}
      <LinearGradient
        colors={colors.gradientBalance}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.balanceCard}
      >
        <View style={styles.eyebrow}>
          <IconWallet size={17} color={colors.blueTextSubtle} />
          <Text style={styles.eyebrowText}>Total Planejado</Text>
        </View>

        <Text style={styles.moneyBig}>
          <Text style={styles.moneySmall}>R$ </Text>
          {formatBRL(current.planejado, false).replace('R$', '').trim()}
          <Text style={styles.moneyCents}>,00</Text>
        </Text>

        <Text style={styles.subtleText}>
          {current.totalAtividades} atividades · {current.percentualExecutado} executado
        </Text>

        <View style={styles.balanceFoot}>
          <View>
            <Text style={styles.footLabel}>Descentralizado</Text>
            <Text style={styles.footValue}>
              {formatBRL(current.descentralizado)}
            </Text>
          </View>
          <View style={styles.footRight}>
            <Text style={styles.footLabel}>Empenhado</Text>
            <Text style={styles.footValue}>{formatBRL(current.empenhado)}</Text>
          </View>
          <DonutChart percentage={current.percentualExecutadoNum} />
        </View>
      </LinearGradient>

      {/* Money Grid (2x2) */}
      <View style={styles.moneyGrid}>
        {/* Metric 1: Empenhado */}
        <View style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <IconDoc size={16} color={colors.blue} />
            <Text style={styles.metricLabel}>Empenhado</Text>
          </View>
          <Text style={styles.metricValue}>
            {formatBRL(current.empenhado, false)}
          </Text>
          <Text style={styles.metricSub}>
            {current.percentualEmpenhado} do descentralizado
          </Text>
        </View>

        {/* Metric 2: Saldo disponível */}
        <View style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <IconWallet size={16} color={colors.blue} />
            <Text style={styles.metricLabel}>Saldo disponível</Text>
          </View>
          <Text style={styles.metricValue}>
            {formatBRL(current.saldoDisponivel, false)}
          </Text>
          <Text style={styles.metricSub}>
            {current.percentualDescentralizado} do descentralizado
          </Text>
        </View>

        {/* Metric 3: Liquidado */}
        <View style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <IconLayers size={16} color={colors.blue} />
            <Text style={styles.metricLabel}>Liquidado</Text>
          </View>
          <Text style={styles.metricValue}>
            {formatBRL(current.liquidado, false)}
          </Text>
          <Text style={styles.metricSub}>
            {current.liquidadoPct} do empenhado
          </Text>
        </View>

        {/* Metric 4: Pago */}
        <View style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <IconCheck size={16} color={colors.green} />
            <Text style={styles.metricLabel}>Pago</Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.green }]}>
            {formatBRL(current.pago, false)}
          </Text>
          <Text style={styles.metricSub}>
            {current.pagoPct} do liquidado
          </Text>
        </View>
      </View>

      {/* Auxiliary Strip: A pagar & A descentralizar */}
      <View style={styles.auxStrip}>
        <View style={styles.auxItem}>
          <IconClock size={14} color="#64748b" />
          <Text style={styles.auxLabel}>A pagar:</Text>
          <Text style={styles.auxValue}>{formatBRL(current.aPagar)}</Text>
        </View>
        <View style={styles.auxDivider} />
        <View style={styles.auxItem}>
          <Text style={styles.auxLabel}>A descentralizar:</Text>
          <Text style={styles.auxValue}>{formatBRL(current.aDescentralizar)}</Text>
        </View>
      </View>

      {/* Semiannual Execution Chart with Real Data */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeadTitle}>Execução no semestre</Text>
        <Text style={styles.sectionHeadUnit}>R$ mil</Text>
      </View>
      <ExecutionChart data={current.monthlyChart} />

      {/* Attention Alert Button */}
      <TouchableOpacity
        style={styles.alertCard}
        onPress={onNavigateToContratosAlert}
        activeOpacity={0.85}
      >
        <View style={styles.alertIcon}>
          <IconClock size={19} color={colors.amber} />
        </View>
        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>{alertTitle}</Text>
          <Text style={styles.alertSubtitle}>
            Vigência termina nos próximos 30 dias.
          </Text>
        </View>
        <IconRight size={16} color={colors.amber} />
      </TouchableOpacity>

      {/* Footer note with real timestamp */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerNote}>
          Referência: {current.referencia}
        </Text>
        <Text style={styles.footerNote}>
          Dados integrados em tempo real ao Supabase (IFRN · Campus Currais Novos)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greeting: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 5,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 19,
  },
  titleText: {
    fontSize: 27,
    letterSpacing: -1,
    fontWeight: '700',
    color: colors.ink,
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  yearText: {
    fontSize: 12,
    color: '#51627b',
    fontWeight: '500',
  },
  balanceCard: {
    padding: 22,
    borderRadius: 22,
    shadowColor: '#234fc8',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowText: {
    color: colors.blueTextSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  moneyBig: {
    fontSize: 32,
    letterSpacing: -1.3,
    fontWeight: '700',
    color: colors.white,
    marginTop: 10,
    marginBottom: 2,
  },
  moneySmall: {
    fontSize: 17,
    color: '#bfcffd',
    fontWeight: '400',
    letterSpacing: 0,
  },
  moneyCents: {
    fontSize: 20,
    fontWeight: '400',
  },
  subtleText: {
    fontSize: 12,
    color: '#d1ddff',
  },
  balanceFoot: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footLabel: {
    fontSize: 12,
    color: '#d1ddff',
  },
  footValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.white,
    marginTop: 4,
  },
  footRight: {
    alignItems: 'flex-end',
  },
  moneyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    backgroundColor: colors.white,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  metricSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 5,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 13,
  },
  sectionHeadTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.ink,
  },
  sectionHeadUnit: {
    fontSize: 12,
    color: colors.muted,
  },
  alertCard: {
    marginTop: 14,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIcon: {
    marginTop: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.amber,
  },
  alertSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
    color: colors.amberSubtitle,
  },
  footerContainer: {
    marginTop: 22,
    alignItems: 'center',
  },
  footerNote: {
    textAlign: 'center',
    color: '#7f8ba0',
    fontSize: 12,
    lineHeight: 20,
  },
  auxStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  auxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  auxDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
  },
  auxLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  auxValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
});
