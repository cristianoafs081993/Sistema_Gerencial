import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { ContratoItem, ContratoFilter } from '../types';
import { IconSearch } from '../components/Icons';
import { ContratoCard } from '../components/ContratoCard';
import { ContratoDetalheModal } from '../components/ContratoDetalheModal';
import { ListSkeleton } from '../components/Skeleton';
import { fetchContratos, fetchUltimaSincronizacaoContratos } from '../services/contratos';
import { formatarMoeda } from '../lib/format';

interface ContratosScreenProps {
  initialFilter?: ContratoFilter;
  onClearInitialFilter?: () => void;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function formatarSincronizacao(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} às ${hora}:${minuto}`;
}

export const ContratosScreen: React.FC<ContratosScreenProps> = ({
  initialFilter = 'all',
  onClearInitialFilter,
}) => {
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<ContratoFilter>(initialFilter);
  const [selecionado, setSelecionado] = useState<ContratoItem | null>(null);

  const carregar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErro(null);
    try {
      const [lista, sync] = await Promise.all([
        fetchContratos(),
        fetchUltimaSincronizacaoContratos().catch(() => null),
      ]);
      setContratos(lista);
      setUltimaSync(sync);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      setErro('Não foi possível carregar os contratos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (initialFilter) setFiltro(initialFilter);
  }, [initialFilter]);

  const resumo = useMemo(() => {
    const ativos = contratos.filter((c) => c.status !== 'expirado');
    return {
      ativos: ativos.length,
      valorAtivos: ativos.reduce((soma, c) => soma + c.valorGlobal, 0),
      aVencer: contratos.filter((c) => c.status === 'a_vencer').length,
      pendentes: contratos.filter((c) => c.faturasPendentes > 0).length,
    };
  }, [contratos]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return contratos.filter((c) => {
      const passaBusca =
        !termo ||
        normalizar(c.numero).includes(termo) ||
        normalizar(c.fornecedor).includes(termo) ||
        normalizar(c.objeto).includes(termo);
      if (!passaBusca) return false;
      if (filtro === 'vigente') return c.status !== 'expirado';
      if (filtro === 'vencer') return c.status === 'a_vencer';
      if (filtro === 'pendentes') return c.faturasPendentes > 0;
      return true;
    });
  }, [contratos, busca, filtro]);

  const opcoes: { id: ContratoFilter; label: string }[] = [
    { id: 'all', label: `Todos (${contratos.length})` },
    { id: 'vigente', label: `Vigentes (${resumo.ativos})` },
    { id: 'vencer', label: `A vencer (${resumo.aVencer})` },
    { id: 'pendentes', label: `Faturas pendentes (${resumo.pendentes})` },
  ];

  const escolherFiltro = (id: ContratoFilter) => {
    setFiltro(id);
    onClearInitialFilter?.();
  };

  const sincronizacao = formatarSincronizacao(ultimaSync);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} colors={[colors.blue]} tintColor={colors.blue} />
        }
      >
        <Text style={styles.titleText}>Contratos</Text>
        <Text style={styles.listIntro}>
          {sincronizacao ? `Dados do Comprasnet · atualizado em ${sincronizacao}` : 'Dados do Comprasnet'}
        </Text>

        {loading ? (
          <ListSkeleton count={3} label="Carregando contratos" />
        ) : erro ? (
          <View style={styles.errorCard} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Não foi possível carregar</Text>
            <Text style={styles.errorDesc}>{erro}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => carregar()} accessibilityRole="button">
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryLabel}>Valor global · contratos ativos</Text>
                <Text style={styles.summaryValue}>{formatarMoeda(resumo.valorAtivos, false)}</Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryLabel}>Ativos</Text>
                <Text style={[styles.summaryValue, { color: colors.blue }]}>{resumo.ativos}</Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <IconSearch size={19} color={colors.mutedLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por número, empresa ou objeto"
                placeholderTextColor={colors.mutedText}
                value={busca}
                onChangeText={setBusca}
                clearButtonMode="while-editing"
                accessibilityLabel="Buscar contratos"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
              {opcoes.map((opt) => {
                const selecionada = filtro === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.chip, selecionada && styles.chipSelected]}
                    onPress={() => escolherFiltro(opt.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selecionada }}
                  >
                    <Text style={[styles.chipText, selecionada && styles.chipTextSelected]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.resultRow}>
              <Text style={styles.resultCount}>
                {filtrados.length} {filtrados.length === 1 ? 'contrato' : 'contratos'}
              </Text>
              <Text style={styles.resultSort}>Mais urgentes primeiro</Text>
            </View>

            {filtrados.length > 0 ? (
              filtrados.map((item) => <ContratoCard key={item.uuid} item={item} onPress={setSelecionado} />)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{contratos.length === 0 ? 'Nenhum contrato encontrado' : 'Nenhum resultado'}</Text>
                <Text style={styles.emptyDesc}>
                  {contratos.length === 0
                    ? 'Não há contratos vigentes ou recentes vinculados ao seu campus.'
                    : 'Tente outro número, empresa, objeto ou filtro.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ContratoDetalheModal contrato={selecionado} onClose={() => setSelecionado(null)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  titleText: { fontSize: 27, letterSpacing: -1, fontWeight: '800', color: colors.ink },
  listIntro: { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 18 },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    padding: 17,
    marginBottom: 16,
  },
  summaryLeft: { flex: 1 },
  summaryRight: { borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 20, alignItems: 'flex-end' },
  summaryLabel: { color: colors.muted, fontSize: 12 },
  summaryValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.7, color: colors.ink, marginTop: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineInput,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    minHeight: 47,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  chipsContainer: { flexDirection: 'row', gap: 7, marginTop: 14, marginBottom: 16, paddingRight: 18 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: colors.white,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 13, color: colors.tagText, fontWeight: '600' },
  chipTextSelected: { color: colors.white, fontWeight: '700' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  resultCount: { fontSize: 12, color: colors.muted },
  resultSort: { fontSize: 12, color: colors.muted },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mutedExtraLight,
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  errorCard: {
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    alignItems: 'flex-start',
  },
  errorTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  errorDesc: { fontSize: 13, lineHeight: 19, color: colors.inkLight },
  retryButton: { marginTop: 6, backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
