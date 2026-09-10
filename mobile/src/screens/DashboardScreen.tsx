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
  IconChart,
  IconFilter,
  IconChevronDown,
} from '../components/Icons';
import { DonutChart } from '../components/DonutChart';
import { ExecutionChart } from '../components/ExecutionChart';
import { PtresFilterModal } from '../components/PtresFilterModal';
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
  const [selectedPtres, setSelectedPtres] = useState<string>('all');
  const [isPtresModalOpen, setIsPtresModalOpen] = useState(false);

  const loadData = useCallback(async (ptres = selectedPtres, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchDashboardMetrics(undefined, ptres);
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPtres]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPtres = (code: string) => {
    setSelectedPtres(code);
    loadData(code, true);
  };

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

  const currentPtresItem = current.availablePtres?.find((p) => p.code === selectedPtres);
  const ptresButtonLabel =
    selectedPtres === 'all'
      ? 'PTRES: Todos'
      : `PTRES ${selectedPtres}`;

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(selectedPtres, true)}
            colors={[colors.blue]}
            tintColor={colors.blue}
          />
        }
      >
        {/* Greeting */}
        <Text style={styles.greeting}>Olá, {current.usuario}</Text>

        {/* Title Row with PTRES Filter Button */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Visão geral</Text>
          <TouchableOpacity
            style={[
              styles.ptresBadge,
              selectedPtres !== 'all' && styles.ptresBadgeActive,
            ]}
            onPress={() => setIsPtresModalOpen(true)}
            activeOpacity={0.7}
          >
            <IconFilter
              size={13}
              color={selectedPtres !== 'all' ? colors.white : colors.blue}
            />
            <Text
              style={[
                styles.ptresBadgeText,
                selectedPtres !== 'all' && styles.ptresBadgeTextActive,
              ]}
              numberOfLines={1}
            >
              {ptresButtonLabel}
            </Text>
            <IconChevronDown
              size={12}
              color={selectedPtres !== 'all' ? colors.white : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Active PTRES filter indicator banner */}
        {selectedPtres !== 'all' && (
          <View style={styles.activeFilterBanner}>
            <View style={styles.activeFilterLeft}>
              <IconFilter size={12} color={colors.blue} />
              <Text style={styles.activeFilterText} numberOfLines={1}>
                {currentPtresItem?.name || `PTRES ${selectedPtres}`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => handleSelectPtres('all')}
              activeOpacity={0.7}
            >
              <Text style={styles.clearFilterBtnText}>Ver todos ✕</Text>
            </TouchableOpacity>
          </View>
        )}

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
            <Text style={styles.footLabel}>A descentralizar</Text>
            <Text style={styles.footValue}>{formatBRL(current.aDescentralizar)}</Text>
          </View>
          <DonutChart percentage={current.percentualDescentralizadoPlanejadoNum} />
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

        {/* Metric 2: Crédito Disponível */}
        <View style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <IconWallet size={16} color={colors.blue} />
            <Text style={styles.metricLabel}>Crédito Disponível</Text>
          </View>
          <Text style={styles.metricValue}>
            {formatBRL(current.creditoDisponivel ?? current.saldoDisponivel, false)}
          </Text>
          <Text style={styles.metricSub}>
            {current.percentualCreditoDisponivel ?? current.percentualDescentralizado} do descentralizado
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

      {/* Auxiliary Strip: A pagar & Execução */}
      <View style={styles.auxStrip}>
        <View style={styles.auxItem}>
          <IconClock size={14} color="#64748b" />
          <Text style={styles.auxLabel}>A pagar:</Text>
          <Text style={styles.auxValue}>{formatBRL(current.aPagar)}</Text>
        </View>
        <View style={styles.auxDivider} />
        <View style={styles.auxItem}>
          <IconChart size={14} color="#64748b" />
          <Text style={styles.auxLabel}>Execução no planejado:</Text>
          <Text style={styles.auxValue}>{current.percentualExecutado}</Text>
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

      {/* PTRES Selection Modal */}
      <PtresFilterModal
        visible={isPtresModalOpen}
        onClose={() => setIsPtresModalOpen(false)}
        options={current.availablePtres || []}
        selectedCode={selectedPtres}
        onSelect={handleSelectPtres}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
    marginBottom: 16,
  },
  titleText: {
    fontSize: 27,
    letterSpacing: -1,
    fontWeight: '700',
    color: colors.ink,
  },
  ptresBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ecf1ff',
    borderWidth: 1,
    borderColor: '#d7e2fc',
    borderRadius: 10,
  },
  ptresBadgeActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  ptresBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    maxWidth: 130,
  },
  ptresBadgeTextActive: {
    color: colors.white,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 14,
    marginTop: -4,
  },
  activeFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  activeFilterText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  clearFilterBtn: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
  },
  clearFilterBtnText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
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
