import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { colors, radius } from '../constants/theme';
import { formatarDataIso, formatarMoeda } from '../lib/format';
import { codigoPtresDaOrigem } from '../lib/dashboardRules';
import {
  codigoDaDimensao,
  ehEstorno,
  filtrarDescentralizacoes,
  resumirDescentralizacoes,
  type DescentralizacaoLinha,
} from '../lib/orcamentoRules';
import { fetchDescentralizacoes, type DescentralizacoesData } from '../services/orcamento';
import { KNOWN_PTRES_NAMES } from '../services/api';
import { Chip } from '../components/Chip';
import { PtresBars } from '../components/PtresBars';
import { ErrorCard, EmptyCard } from '../components/StateCards';
import { ListSkeleton } from '../components/Skeleton';
import { IconSearch } from '../components/Icons';

const LinhaCard: React.FC<{ item: DescentralizacaoLinha }> = ({ item }) => {
  const estorno = ehEstorno(item);
  const meta = [item.naturezaDespesa ? `ND ${item.naturezaDespesa}` : null, item.planoInterno ? `PI ${item.planoInterno}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card} accessible accessibilityLabel={`Descentralização ${item.origem}, ${formatarMoeda(item.valor)}`}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>{formatarDataIso(item.data)}</Text>
        <View style={styles.dimBadge}>
          <Text style={styles.dimBadgeText}>{codigoDaDimensao(item.dimensao)}</Text>
        </View>
      </View>
      <View style={styles.cardMain}>
        <View style={styles.cardMainLeft}>
          <Text style={styles.cardOrigem} numberOfLines={1}>
            {item.origem}
          </Text>
          {item.notaCredito ? <Text style={styles.cardNota}>NC {item.notaCredito}</Text> : null}
        </View>
        <Text style={[styles.cardValor, estorno && { color: colors.danger }]}>{formatarMoeda(item.valor, false)}</Text>
      </View>
      {item.descricao ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.descricao}
        </Text>
      ) : null}
      {meta || estorno ? (
        <View style={styles.cardFoot}>
          {meta ? <Text style={styles.cardMeta}>{meta}</Text> : <View />}
          {estorno ? <Text style={styles.estorno}>Anulação</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

export const DescentralizacoesScreen: React.FC = () => {
  const [data, setData] = useState<DescentralizacoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ptres, setPtres] = useState('all');

  const carregar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErro(null);
    try {
      setData(await fetchDescentralizacoes());
    } catch (error) {
      console.error('Erro ao carregar descentralizações:', error);
      setErro('Não foi possível carregar as descentralizações. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const codigosPtres = useMemo(() => {
    if (!data) return [];
    const codigos = new Set<string>();
    data.contaSaldos.forEach((c) => codigos.add(c.ptres.trim()));
    data.linhas.forEach((l) => {
      const codigo = codigoPtresDaOrigem(l.origem);
      if (codigo) codigos.add(codigo);
    });
    return Array.from(codigos).sort();
  }, [data]);

  const resumo = useMemo(
    () => (data ? resumirDescentralizacoes({ linhas: data.linhas, contaSaldos: data.contaSaldos, ptres, busca }) : null),
    [data, ptres, busca],
  );
  const linhas = useMemo(() => (data ? filtrarDescentralizacoes(data.linhas, { ptres, busca }) : []), [data, ptres, busca]);

  const cabecalho = (
    <View>
      <Text style={styles.titleText}>Descentralizações</Text>
      <Text style={styles.intro}>Créditos recebidos pelo campus.</Text>

      {loading ? (
        <ListSkeleton count={3} label="Carregando descentralizações" />
      ) : erro ? (
        <ErrorCard message={erro} onRetry={() => carregar()} />
      ) : resumo ? (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>{resumo.oficial ? 'Saldo oficial da conta' : 'Soma dos lançamentos'}</Text>
              <Text style={styles.summaryValue}>{formatarMoeda(resumo.total, false)}</Text>
              <Text style={styles.summaryHint}>
                {resumo.oficial ? 'Conta de descentralizações (SIAFI)' : busca.trim() ? 'Somente os lançamentos da busca' : 'Sem saldo oficial importado'}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Lançamentos</Text>
              <Text style={[styles.summaryValue, { color: colors.blue }]}>{resumo.quantidade}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <IconSearch size={19} color={colors.mutedLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por dimensão, origem, plano ou descrição"
              placeholderTextColor={colors.mutedText}
              value={busca}
              onChangeText={setBusca}
              clearButtonMode="while-editing"
              accessibilityLabel="Buscar descentralizações"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip label="Todos os PTRES" selected={ptres === 'all'} onPress={() => setPtres('all')} />
            {codigosPtres.map((codigo) => (
              <Chip key={codigo} label={codigo} selected={ptres === codigo} onPress={() => setPtres(ptres === codigo ? 'all' : codigo)} />
            ))}
          </ScrollView>

          {ptres === 'all' && resumo.porPtres.length > 1 ? (
            <View>
              <Text style={styles.sectionTitle}>Por PTRES</Text>
              <PtresBars dados={resumo.porPtres} nomes={KNOWN_PTRES_NAMES} onSelect={setPtres} />
            </View>
          ) : null}

          <View style={styles.listHead}>
            <Text style={styles.sectionTitle}>Lançamentos</Text>
            <Text style={styles.resultSort}>Mais recentes primeiro</Text>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={loading || erro ? [] : linhas}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <LinhaCard item={item} />}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={
        loading || erro ? null : (
          <EmptyCard
            title={data && data.linhas.length === 0 ? 'Nenhuma descentralização' : 'Nenhum resultado'}
            description={data && data.linhas.length === 0 ? 'Não há descentralizações registradas para o seu campus.' : 'Tente outro termo ou PTRES.'}
          />
        )
      }
      initialNumToRender={8}
      windowSize={7}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} colors={[colors.blue]} tintColor={colors.blue} />}
    />
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
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, marginTop: 20, marginBottom: 10 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  resultSort: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15, marginBottom: 10, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 12, fontWeight: '700', color: colors.muted },
  dimBadge: { backgroundColor: colors.blueBg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill },
  dimBadgeText: { fontSize: 11.5, fontWeight: '800', color: colors.blue },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardMainLeft: { flex: 1, gap: 2 },
  cardOrigem: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  cardNota: { fontSize: 11.5, color: colors.mutedText },
  cardValor: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5, color: colors.blue },
  cardDesc: { fontSize: 12.5, lineHeight: 18, color: colors.muted },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { fontSize: 11.5, color: colors.mutedText },
  estorno: { fontSize: 11.5, fontWeight: '800', color: colors.danger },
});
