import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';
import { IconWallet, IconDoc, IconLayers, IconCheck, IconClock, IconRight, IconFilter, IconChevronDown } from '../components/Icons';
import { GaugeChart } from '../components/GaugeChart';
import { KpiCard } from '../components/KpiCard';
import { FunnelCard, type EtapaFunil } from '../components/FunnelCard';
import { MonthlyChart } from '../components/MonthlyChart';
import { PtresFilterModal } from '../components/PtresFilterModal';
import { Skeleton } from '../components/Skeleton';
import { fetchDashboard, type DashboardData } from '../services/dashboard';

interface DashboardScreenProps {
  userName: string;
  onNavigateToContratosAlert: () => void;
  /** Se o usuário não pode abrir Contratos, o alerta some. */
  canOpenContratos?: boolean;
}

const pct = (valor: number) => `${valor.toFixed(1).replace('.', ',')}%`;

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName, onNavigateToContratosAlert, canOpenContratos = true }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selectedPtres, setSelectedPtres] = useState<string>('all');
  const [isPtresModalOpen, setIsPtresModalOpen] = useState(false);

  const carregar = useCallback(async (ptres: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErro(null);
    try {
      setData(await fetchDashboard(undefined, ptres));
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      setErro('Não foi possível carregar o painel. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar('all');
  }, [carregar]);

  const escolherPtres = (code: string) => {
    setSelectedPtres(code);
    carregar(code, true);
  };

  const metricas = data?.metricas;
  const etapas = useMemo<EtapaFunil[]>(() => {
    if (!metricas) return [];
    return [
      {
        label: 'Planejado',
        value: metricas.planejado,
        ratio: metricas.planejado > 0 ? 100 : 0,
        caption: `${metricas.totalAtividades} ${metricas.totalAtividades === 1 ? 'atividade' : 'atividades'}`,
        color: colors.blue,
      },
      {
        label: 'Empenhado',
        value: metricas.empenhado,
        ratio: metricas.pctExecutado,
        caption: `${pct(metricas.pctExecutado)} do planejado`,
        color: colors.sky,
      },
      {
        label: 'Liquidado',
        value: metricas.liquidado,
        ratio: metricas.planejado > 0 ? (metricas.liquidado / metricas.planejado) * 100 : 0,
        caption: `${pct(metricas.pctLiquidadoEmpenhado)} do empenhado`,
        color: colors.cyan,
      },
      {
        label: 'Pago',
        value: metricas.pago,
        ratio: metricas.planejado > 0 ? (metricas.pago / metricas.planejado) * 100 : 0,
        caption: `${pct(metricas.pctPagoLiquidado)} do liquidado`,
        color: colors.greenProgress,
      },
    ];
  }, [metricas]);

  const ptresAtivo = data?.ptres.find((p) => p.code === selectedPtres);
  const ptresLabel = selectedPtres === 'all' ? 'PTRES: Todos' : `PTRES ${selectedPtres}`;
  const aVencer = data?.contratos?.aVencer ?? 0;
  const ano = new Date().getFullYear();

  const cabecalho = (
    <>
      <Text style={styles.greeting}>Olá, {userName}</Text>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>Visão geral</Text>
          <Text style={styles.titleSub}>Execução orçamentária {ano}</Text>
        </View>
        <TouchableOpacity
          style={[styles.ptresBadge, selectedPtres !== 'all' && styles.ptresBadgeActive]}
          onPress={() => setIsPtresModalOpen(true)}
          disabled={!data}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Filtrar por PTRES. Atual: ${ptresLabel}`}
        >
          <IconFilter size={13} color={selectedPtres !== 'all' ? colors.white : colors.blue} />
          <Text style={[styles.ptresBadgeText, selectedPtres !== 'all' && styles.ptresBadgeTextActive]} numberOfLines={1}>
            {ptresLabel}
          </Text>
          <IconChevronDown size={12} color={selectedPtres !== 'all' ? colors.white : colors.mutedText} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(selectedPtres, true)} colors={[colors.blue]} tintColor={colors.blue} />
        }
      >
        {cabecalho}

        {loading && !data ? <DashboardSkeleton /> : null}

        {erro ? (
          <View style={styles.errorCard} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Não foi possível carregar</Text>
            <Text style={styles.errorDesc}>{erro}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => carregar(selectedPtres)} accessibilityRole="button">
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {metricas && data ? (
          <>
            {selectedPtres !== 'all' ? (
              <View style={styles.activeFilterBanner}>
                <View style={styles.activeFilterLeft}>
                  <IconFilter size={12} color={colors.blue} />
                  <Text style={styles.activeFilterText} numberOfLines={1}>
                    {ptresAtivo?.name || `PTRES ${selectedPtres}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => escolherPtres('all')} activeOpacity={0.7} accessibilityRole="button">
                  <Text style={styles.clearFilterText}>Ver todos ✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {metricas.semDados ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Sem dados neste recorte</Text>
                <Text style={styles.emptyDesc}>Não há atividades, descentralizações ou empenhos do exercício para o filtro escolhido.</Text>
              </View>
            ) : null}

            <LinearGradient colors={colors.gradientBalance} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroEyebrow}>
                <IconWallet size={16} color={colors.blueTextSubtle} />
                <Text style={styles.heroEyebrowText}>Planejado</Text>
              </View>
              <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
                {formatarMoeda(metricas.planejado)}
              </Text>
              <Text style={styles.heroSub}>
                {metricas.totalAtividades} {metricas.totalAtividades === 1 ? 'atividade' : 'atividades'} · {pct(metricas.pctExecutado)} executado
              </Text>

              <View style={styles.heroBarBg}>
                <View style={[styles.heroBarFill, { width: `${Math.min(metricas.pctDescentralizado, 100)}%` }]} />
              </View>

              <View style={styles.heroFoot}>
                <View style={styles.heroFootItem}>
                  <Text style={styles.heroFootLabel}>Descentralizado</Text>
                  <Text style={styles.heroFootValue}>{formatarMoeda(metricas.descentralizado, false)}</Text>
                  <Text style={styles.heroFootPct}>{pct(metricas.pctDescentralizado)} do planejado</Text>
                </View>
                <View style={[styles.heroFootItem, styles.heroFootRight]}>
                  <Text style={styles.heroFootLabel}>A descentralizar</Text>
                  <Text style={styles.heroFootValue}>{formatarMoeda(Math.max(0, metricas.aDescentralizar), false)}</Text>
                  <Text style={styles.heroFootPct}>
                    {metricas.aDescentralizar < 0 ? 'Acima do planejado' : `${pct(Math.max(0, 100 - metricas.pctDescentralizado))} restante`}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <SectionTitle title="Velocímetros de execução" hint="sobre o descentralizado" />
            <View style={styles.gaugesCard}>
              <GaugeChart label="Empenhado" caption={formatarMoeda(metricas.empenhado, false)} value={metricas.empenhado} total={metricas.descentralizado} />
              <View style={styles.gaugeDivider} />
              <GaugeChart label="Liquidado" caption={formatarMoeda(metricas.liquidado, false)} value={metricas.liquidado} total={metricas.descentralizado} />
            </View>

            <SectionTitle title="Indicadores" />
            <View style={styles.grid}>
              <KpiCard
                label="Empenhado"
                value={formatarMoeda(metricas.empenhado, false)}
                caption={`${pct(metricas.pctExecutado)} do planejado`}
                progress={metricas.pctExecutado}
                tone={colors.sky}
                icon={<IconDoc size={15} color={colors.sky} />}
              />
              <KpiCard
                label="Crédito disponível"
                value={formatarMoeda(metricas.creditoDisponivel, false)}
                caption={`${pct(metricas.pctCreditoDescentralizado)} do descentralizado`}
                progress={metricas.pctCreditoDescentralizado}
                tone={colors.tealText}
                icon={<IconWallet size={15} color={colors.tealText} />}
              />
              <KpiCard
                label="Liquidado"
                value={formatarMoeda(metricas.liquidado, false)}
                caption={`${pct(metricas.pctLiquidadoEmpenhado)} do empenhado`}
                progress={metricas.pctLiquidadoEmpenhado}
                tone="#0891B2"
                icon={<IconLayers size={15} color="#0891B2" />}
              />
              <KpiCard
                label="Pago"
                value={formatarMoeda(metricas.pago, false)}
                caption={`${pct(metricas.pctPagoLiquidado)} do liquidado`}
                progress={metricas.pctPagoLiquidado}
                tone={colors.greenProgress}
                icon={<IconCheck size={15} color={colors.greenProgress} />}
              />
            </View>

            <View style={styles.auxStrip}>
              <IconClock size={15} color={colors.mutedText} />
              <Text style={styles.auxLabel}>A pagar (liquidado − pago)</Text>
              <Text style={styles.auxValue}>{formatarMoeda(metricas.aPagar, false)}</Text>
            </View>

            <SectionTitle title="Funil de execução" hint="do planejado ao pago" />
            <FunnelCard etapas={etapas} />

            <SectionTitle title="Execução por mês" hint="data do empenho" />
            <MonthlyChart dados={metricas.mensal} />

            {canOpenContratos && aVencer > 0 ? (
              <TouchableOpacity style={styles.alertCard} onPress={onNavigateToContratosAlert} activeOpacity={0.85} accessibilityRole="button">
                <View style={styles.alertIcon}>
                  <IconClock size={19} color={colors.amber} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>
                    {aVencer === 1 ? 'Um contrato vence em breve' : `${aVencer} contratos vencem em breve`}
                  </Text>
                  <Text style={styles.alertSubtitle}>Vigência termina nos próximos 90 dias.</Text>
                </View>
                <IconRight size={16} color={colors.amber} />
              </TouchableOpacity>
            ) : null}

            <Text style={styles.footerNote}>
              Atualizado às {data.atualizadoEm.getHours().toString().padStart(2, '0')}:{data.atualizadoEm.getMinutes().toString().padStart(2, '0')} ·
              puxe para baixo para atualizar
            </Text>
          </>
        ) : null}
      </ScrollView>

      <PtresFilterModal
        visible={isPtresModalOpen}
        onClose={() => setIsPtresModalOpen(false)}
        options={data?.ptres ?? []}
        selectedCode={selectedPtres}
        onSelect={escolherPtres}
      />
    </View>
  );
};

const SectionTitle: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {title}
    </Text>
    {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
  </View>
);

const DashboardSkeleton: React.FC = () => (
  <View style={styles.skeletonStack} accessibilityRole="progressbar" accessibilityLabel="Carregando painel">
    <Skeleton height={190} radius={22} />
    <Skeleton height={150} radius={18} />
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={96} radius={18} style={styles.skeletonKpi} />
      ))}
    </View>
    <Skeleton height={220} radius={18} />
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  greeting: { fontSize: 14, color: colors.muted, marginBottom: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 10 },
  titleBlock: { flexShrink: 1 },
  titleText: { fontSize: 28, fontWeight: '800', letterSpacing: -1.1, color: colors.ink },
  titleSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  ptresBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.blueLight,
    backgroundColor: colors.blueBg,
    maxWidth: 170,
  },
  ptresBadgeActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  ptresBadgeText: { fontSize: 12.5, fontWeight: '800', color: colors.blue, flexShrink: 1 },
  ptresBadgeTextActive: { color: colors.white },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.blueBg,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  activeFilterLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  activeFilterText: { fontSize: 12.5, fontWeight: '700', color: colors.blue, flexShrink: 1 },
  clearFilterText: { fontSize: 12.5, fontWeight: '800', color: colors.blue },
  hero: { borderRadius: 22, padding: 20, gap: 4, marginBottom: 6 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroEyebrowText: { fontSize: 14, fontWeight: '700', color: colors.blueTextSubtle },
  heroValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1.4, color: colors.white, marginTop: 6 },
  heroSub: { fontSize: 13, color: colors.blueTextSubtle },
  heroBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden', marginTop: 16 },
  heroBarFill: { height: '100%', backgroundColor: colors.white, borderRadius: 3 },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  heroFootItem: { flex: 1, gap: 2 },
  heroFootRight: { alignItems: 'flex-end' },
  heroFootLabel: { fontSize: 12, color: colors.blueTextSubtle },
  heroFootValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.white },
  heroFootPct: { fontSize: 11.5, color: colors.blueTextSubtle },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  sectionHint: { fontSize: 12, color: colors.muted },
  gaugesCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  gaugeDivider: { width: 1, backgroundColor: colors.line, marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  auxStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  auxLabel: { flex: 1, fontSize: 12.5, color: colors.muted },
  auxValue: { fontSize: 14, fontWeight: '800', color: colors.ink },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 22,
  },
  alertIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.amberBadgeBg, alignItems: 'center', justifyContent: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14.5, fontWeight: '800', color: colors.amberText },
  alertSubtitle: { fontSize: 12.5, color: colors.amberSubtitle, marginTop: 2 },
  footerNote: { textAlign: 'center', fontSize: 12, color: colors.mutedText, marginTop: 22 },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mutedExtraLight,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    gap: 4,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  emptyDesc: { fontSize: 13, color: colors.muted },
  errorCard: { backgroundColor: colors.dangerBg, borderRadius: radius.lg, padding: 18, gap: 8, alignItems: 'flex-start' },
  errorTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  errorDesc: { fontSize: 13, lineHeight: 19, color: colors.inkLight },
  retryButton: { marginTop: 6, backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
  skeletonStack: { gap: 14 },
  skeletonKpi: { flexBasis: '48%', flexGrow: 1 },
});
