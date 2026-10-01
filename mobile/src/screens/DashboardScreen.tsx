import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Text } from '../components/AppText';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';
import { IconWallet, IconClock, IconRight, IconFilter } from '../components/Icons';
import { GaugeChart } from '../components/GaugeChart';
import { FunnelCard, type EtapaFunil } from '../components/FunnelCard';
import { Skeleton } from '../components/Skeleton';
import { fetchDashboard, type DashboardData } from '../services/dashboard';
import type { PtresItem } from '../types';

interface DashboardScreenProps {
  /** PTRES escolhido no filtro do header ('all' = todos). */
  selectedPtres: string;
  onSelectPtres: (code: string) => void;
  /** Informa ao header quais PTRES existem para o filtro. */
  onPtresOptions: (options: PtresItem[]) => void;
  onNavigateToContratosAlert: () => void;
  /** Se o usuário não pode abrir Contratos, o alerta some. */
  canOpenContratos?: boolean;
}

const pct = (valor: number) => `${valor.toFixed(1).replace('.', ',')}%`;

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ selectedPtres, onSelectPtres, onPtresOptions, onNavigateToContratosAlert, canOpenContratos = true }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const carregouUmaVez = useRef(false);

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
    carregar(selectedPtres, carregouUmaVez.current);
    carregouUmaVez.current = true;
  }, [carregar, selectedPtres]);

  useEffect(() => {
    if (data) onPtresOptions(data.ptres);
  }, [data, onPtresOptions]);

  const metricas = data?.metricas;
  const etapas = useMemo<EtapaFunil[]>(() => {
    if (!metricas) return [];
    return [
      {
        label: 'Planejado',
        value: metricas.planejado,
        ratio: metricas.planejado > 0 ? 100 : 0,
        caption: `${metricas.totalAtividades} ${metricas.totalAtividades === 1 ? 'atividade' : 'atividades'}`,
        color: '#0D47A1',
      },
      {
        label: 'Descentralizado',
        value: metricas.descentralizado,
        ratio: metricas.pctDescentralizado,
        caption: `${pct(metricas.pctDescentralizado)} do planejado`,
        color: colors.blue,
      },
      {
        label: 'Empenhado',
        value: metricas.empenhado,
        ratio: metricas.pctExecutado,
        caption: `${pct(metricas.pctExecutado)} do planejado`,
        color: '#42A5F5',
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
  const aVencer = data?.contratos?.aVencer ?? 0;

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
                <TouchableOpacity onPress={() => onSelectPtres('all')} activeOpacity={0.7} accessibilityRole="button">
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

            <View style={styles.hero}>
              <View style={styles.heroEyebrow}>
                <IconWallet size={16} color={colors.muted} />
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
            </View>

            <SectionTitle title="Velocímetros de execução" hint="sobre o descentralizado" />
            <View style={styles.gaugesCard}>
              <GaugeChart label="Empenhado" caption={formatarMoeda(metricas.empenhado, false)} value={metricas.empenhado} total={metricas.descentralizado} />
              <View style={styles.gaugeDivider} />
              <GaugeChart label="Liquidado" caption={formatarMoeda(metricas.liquidado, false)} value={metricas.liquidado} total={metricas.descentralizado} />
            </View>

            <SectionTitle title="Funil de execução" hint="do planejado ao pago" />
            <FunnelCard etapas={etapas} />

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
  hero: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 18,
    gap: 4,
    marginBottom: 6,
  },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroEyebrowText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  heroValue: { fontSize: 30, fontWeight: '800', letterSpacing: -1.1, color: colors.blue, marginTop: 4 },
  heroSub: { fontSize: 13, color: colors.muted },
  heroBarBg: { height: 6, backgroundColor: colors.progressBg, borderRadius: 3, overflow: 'hidden', marginTop: 14 },
  heroBarFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 3 },
  activeFilterLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  activeFilterText: { fontSize: 12.5, fontWeight: '700', color: colors.blue, flexShrink: 1 },
  clearFilterText: { fontSize: 12.5, fontWeight: '800', color: colors.blue },
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
