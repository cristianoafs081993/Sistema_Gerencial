import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';
import { creditoPorPtres, filtrarCredito, totalCredito, type CreditoLinha, type FiltroSaldo } from '../lib/orcamentoRules';
import { fetchCredito, type CreditoData } from '../services/orcamento';
import { KNOWN_PTRES_NAMES } from '../services/api';
import { Chip } from '../components/Chip';
import { CreditoDetalheModal } from '../components/CreditoDetalheModal';
import { PtresBars } from '../components/PtresBars';
import { ErrorCard, EmptyCard } from '../components/StateCards';
import { ListSkeleton } from '../components/Skeleton';
import { IconRight, IconSearch } from '../components/Icons';

function formatarImportacao(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} às ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

const SALDOS: { id: FiltroSaldo; label: string }[] = [
  { id: 'com-saldo', label: 'Com saldo' },
  { id: 'zerado', label: 'Zerados' },
  { id: 'todos', label: 'Todos' },
];

export const CreditoScreen: React.FC = () => {
  const [data, setData] = useState<CreditoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ptres, setPtres] = useState('all');
  const [saldo, setSaldo] = useState<FiltroSaldo>('com-saldo');
  const [selecionada, setSelecionada] = useState<CreditoLinha | null>(null);

  const carregar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErro(null);
    try {
      setData(await fetchCredito());
    } catch (error) {
      console.error('Erro ao carregar crédito disponível:', error);
      setErro('Não foi possível carregar o crédito disponível. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const codigos = useMemo(() => Array.from(new Set((data?.linhas ?? []).map((l) => l.ptres))).sort(), [data]);
  const linhas = useMemo(() => (data ? filtrarCredito(data.linhas, { ptres, saldo, busca }) : []), [data, ptres, saldo, busca]);
  const total = useMemo(() => totalCredito(linhas), [linhas]);
  const porPtres = useMemo(() => creditoPorPtres(linhas), [linhas]);
  const importacao = formatarImportacao(data?.importadoEm ?? null);

  const cabecalho = (
    <View>
      <Text style={styles.titleText}>Crédito disponível</Text>
      <Text style={styles.intro}>
        {importacao ? `Relatório do SIAFI · importado em ${importacao}` : 'Saldo por PTRES e plano interno.'}
      </Text>

      {loading ? (
        <ListSkeleton count={3} label="Carregando crédito disponível" />
      ) : erro ? (
        <ErrorCard message={erro} onRetry={() => carregar()} />
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>Crédito disponível</Text>
              <Text style={[styles.summaryValue, { color: colors.tealText }]}>{formatarMoeda(total, false)}</Text>
              <Text style={styles.summaryHint}>{ptres === 'all' ? 'Todos os PTRES' : `PTRES ${ptres}`}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Linhas</Text>
              <Text style={[styles.summaryValue, { color: colors.blue }]}>{linhas.length}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <IconSearch size={19} color={colors.mutedLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por PTRES, PI ou descrição"
              placeholderTextColor={colors.mutedText}
              value={busca}
              onChangeText={setBusca}
              clearButtonMode="while-editing"
              accessibilityLabel="Buscar crédito disponível"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip label="Todos os PTRES" selected={ptres === 'all'} onPress={() => setPtres('all')} />
            {codigos.map((codigo) => (
              <Chip key={codigo} label={codigo} selected={ptres === codigo} onPress={() => setPtres(ptres === codigo ? 'all' : codigo)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsRow, styles.chipsRowTight]}>
            {SALDOS.map((opt) => (
              <Chip key={opt.id} label={opt.label} selected={saldo === opt.id} onPress={() => setSaldo(opt.id)} small />
            ))}
          </ScrollView>

          {ptres === 'all' && porPtres.filter((p) => p.valor > 0).length > 1 ? (
            <View>
              <Text style={styles.sectionTitle}>Por PTRES</Text>
              <PtresBars dados={porPtres} nomes={KNOWN_PTRES_NAMES} tone={colors.cyan} onSelect={setPtres} />
            </View>
          ) : null}

          <View style={styles.listHead}>
            <Text style={styles.sectionTitle}>Linhas do relatório</Text>
            <Text style={styles.resultSort}>Toque para ver os empenhos</Text>
          </View>
        </>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={loading || erro ? [] : linhas}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => setSelecionada(item)}
            accessibilityRole="button"
            accessibilityLabel={`PTRES ${item.ptres}, ${item.descricao}, ${formatarMoeda(item.valor)}. Toque para ver os empenhos.`}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardCode}>
                PTRES {item.ptres}
                {item.planoInterno ? ` · PI ${item.planoInterno}` : ''}
              </Text>
              <IconRight size={15} color={colors.mutedLight} />
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.descricao || 'Sem descrição'}
            </Text>
            <Text style={[styles.cardValor, item.valor === 0 && { color: colors.mutedLight }]}>{formatarMoeda(item.valor)}</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          loading || erro ? null : (
            <EmptyCard
              title={data && data.linhas.length === 0 ? 'Nenhum relatório importado' : 'Nenhuma linha encontrada'}
              description={
                data && data.linhas.length === 0
                  ? 'Ainda não há relatório de crédito disponível para o seu campus.'
                  : 'Tente outro PTRES, termo de busca ou filtro de saldo.'
              }
            />
          )
        }
        initialNumToRender={10}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} colors={[colors.blue]} tintColor={colors.blue} />}
      />
      <CreditoDetalheModal linha={selecionada} onClose={() => setSelecionada(null)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 },
  titleText: { fontSize: 27, letterSpacing: -1, fontWeight: '800', color: colors.ink },
  intro: { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 16 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    padding: 17,
    marginBottom: 14,
  },
  summaryLeft: { flex: 1 },
  summaryRight: { borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 20, alignItems: 'flex-end' },
  summaryLabel: { color: colors.muted, fontSize: 12 },
  summaryValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.7, color: colors.ink, marginTop: 6 },
  summaryHint: { fontSize: 11.5, color: colors.mutedText, marginTop: 2 },
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
  chipsRow: { flexDirection: 'row', gap: 7, marginTop: 12, paddingRight: 18 },
  chipsRowTight: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, marginTop: 20, marginBottom: 10 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  resultSort: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15, marginBottom: 10, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCode: { fontSize: 12.5, fontWeight: '800', color: colors.muted },
  cardDesc: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  cardValor: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: colors.tealText, marginTop: 2 },
});
