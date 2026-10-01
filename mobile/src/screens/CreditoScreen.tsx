import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { colors, radius } from '../constants/theme';
import { creditoPorPtres, filtrarCredito, type CreditoLinha } from '../lib/orcamentoRules';
import { fetchCredito, type CreditoData } from '../services/orcamento';
import { KNOWN_PTRES_NAMES } from '../services/api';
import { CreditoDetalheModal } from '../components/CreditoDetalheModal';
import { PtresBars } from '../components/PtresBars';
import { ErrorCard, EmptyCard } from '../components/StateCards';
import { ListSkeleton } from '../components/Skeleton';
import { IconSearch } from '../components/Icons';

function formatarImportacao(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} às ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export const CreditoScreen: React.FC = () => {
  const [data, setData] = useState<CreditoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
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

  const linhas = useMemo(() => (data ? filtrarCredito(data.linhas, { ptres: 'all', saldo: 'com-saldo', busca }) : []), [data, busca]);
  const porPtres = useMemo(() => creditoPorPtres(linhas), [linhas]);
  const abrirPtres = (codigo: string) => {
    const item = porPtres.find((p) => p.ptres === codigo);
    if (item) setSelecionada({ id: codigo, ptres: codigo, planoInterno: '', descricao: KNOWN_PTRES_NAMES[codigo] ?? '', valor: item.valor });
  };
  const importacao = formatarImportacao(data?.importadoEm ?? null);

  const cabecalho = (
    <View>
      <Text style={styles.intro}>
        {importacao ? `Relatório do SIAFI · importado em ${importacao}` : 'Saldo por PTRES e plano interno.'}
      </Text>

      {loading ? (
        <ListSkeleton count={3} label="Carregando crédito disponível" />
      ) : erro ? (
        <ErrorCard message={erro} onRetry={() => carregar()} />
      ) : (
        <>
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

          {porPtres.some((p) => p.valor > 0) ? (
            <View>
              <Text style={styles.sectionTitle}>Por PTRES</Text>
              <PtresBars dados={porPtres} nomes={KNOWN_PTRES_NAMES} tone={colors.cyan} onSelect={abrirPtres} />
            </View>
          ) : null}

        </>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={[] as CreditoLinha[]}
        renderItem={() => null}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          loading || erro || porPtres.length > 0 ? null : (
            <EmptyCard
              title={data && data.linhas.length === 0 ? 'Nenhum relatório importado' : 'Nenhuma linha encontrada'}
              description={
                data && data.linhas.length === 0
                  ? 'Ainda não há relatório de crédito disponível para o seu campus.'
                  : 'Tente outro PTRES, plano interno ou descrição.'
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
  intro: { fontSize: 11, color: colors.muted, marginBottom: 12 },
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
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, marginTop: 20, marginBottom: 10 },
});
