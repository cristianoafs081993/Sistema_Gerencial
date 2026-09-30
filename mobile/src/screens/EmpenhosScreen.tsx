import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { colors, radius } from '../constants/theme';
import { formatarMoeda } from '../lib/format';
import { EmpenhoItem, EmpenhoFilter } from '../types';
import { IconSearch } from '../components/Icons';
import { EmpenhoCard } from '../components/EmpenhoCard';
import { EmpenhoDetalheModal } from '../components/EmpenhoDetalheModal';
import { ListSkeleton } from '../components/Skeleton';
import { fetchEmpenhos } from '../services/api';

type StatusFilter = 'all' | 'liquidar' | 'pagar' | 'pago';

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const EmpenhosScreen: React.FC = () => {
  const [empenhos, setEmpenhos] = useState<EmpenhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<EmpenhoFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selecionado, setSelecionado] = useState<EmpenhoItem | null>(null);

  const carregar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErro(null);
    try {
      setEmpenhos(await fetchEmpenhos());
    } catch (error) {
      console.error('Erro ao carregar empenhos:', error);
      setErro('Não foi possível carregar os empenhos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagem = useMemo(
    () => ({
      exercicio: empenhos.filter((e) => e.tipo === 'exercicio').length,
      rap: empenhos.filter((e) => e.tipo === 'rap').length,
    }),
    [empenhos],
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    const lista = empenhos.filter((item) => {
      const passaBusca =
        !termo || normalizar(item.id).includes(termo) || normalizar(item.name).includes(termo) || normalizar(item.desc).includes(termo);
      const passaTipo = tipo === 'all' || item.tipo === tipo;
      const passaStatus = status === 'all' || item.status === status;
      return passaBusca && passaTipo && passaStatus;
    });

    if (tipo === 'rap') {
      // Pendentes (saldo > 0) no topo, como no acompanhamento web.
      return [...lista].sort((a, b) => {
        const saldoA = a.saldo ?? a.value;
        const saldoB = b.saldo ?? b.value;
        if (saldoA > 0 && saldoB <= 0) return -1;
        if (saldoA <= 0 && saldoB > 0) return 1;
        return 0;
      });
    }
    return lista;
  }, [empenhos, busca, tipo, status]);

  // Exercício e restos a pagar têm bases diferentes (empenhado × saldo); nunca somamos os dois.
  const resumo = useMemo(() => {
    const exercicio = filtrados.filter((item) => item.tipo !== 'rap');
    const rap = filtrados.filter((item) => item.tipo === 'rap');
    const empenhado = exercicio.reduce((soma, item) => soma + item.value, 0);
    const pagoExercicio = exercicio.reduce((soma, item) => soma + item.paid, 0);
    const saldoRap = rap.reduce((soma, item) => soma + (item.saldo ?? item.value), 0);
    const inscritoRap = rap.reduce((soma, item) => soma + (item.inscrito ?? item.value), 0);
    const pagoRap = rap.reduce((soma, item) => soma + item.paid, 0);
    const pendentesRap = rap.filter((item) => (item.saldo ?? item.value) > 0).length;

    if (tipo === 'rap') {
      return {
        rotulo: 'Saldo de restos a pagar',
        valor: saldoRap,
        apoio: `Inscrito ${formatarMoeda(inscritoRap, false)} · Pago ${formatarMoeda(pagoRap, false)}`,
        contador: `${pendentesRap}/${filtrados.length}`,
        contadorRotulo: 'Pendentes',
      };
    }
    return {
      rotulo: 'Empenhado no exercício',
      valor: empenhado,
      apoio:
        tipo === 'all'
          ? `Pago ${formatarMoeda(pagoExercicio, false)} · Saldo RAP ${formatarMoeda(saldoRap, false)}`
          : `Pago ${formatarMoeda(pagoExercicio, false)}`,
      contador: String(filtrados.length),
      contadorRotulo: 'Empenhos',
    };
  }, [filtrados, tipo]);

  const tipos: { id: EmpenhoFilter; label: string }[] = [
    { id: 'all', label: `Todos (${empenhos.length})` },
    { id: 'exercicio', label: `Exercício (${contagem.exercicio})` },
    { id: 'rap', label: `Restos a pagar (${contagem.rap})` },
  ];
  const situacoes: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Qualquer situação' },
    { id: 'liquidar', label: 'A liquidar' },
    { id: 'pagar', label: 'A pagar' },
    { id: 'pago', label: 'Pagos' },
  ];

  const cabecalho = (
    <View>
      <Text style={styles.titleText}>Empenhos</Text>
      <Text style={styles.listIntro}>Do compromisso ao pagamento.</Text>

      {loading ? (
        <ListSkeleton count={3} label="Carregando empenhos" />
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
              <Text style={styles.summaryLabel}>{resumo.rotulo}</Text>
              <Text style={styles.summaryValue}>{formatarMoeda(resumo.valor, false)}</Text>
              <Text style={styles.summarySub}>{resumo.apoio}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>{resumo.contadorRotulo}</Text>
              <Text style={[styles.summaryValue, { color: colors.blue }]}>{resumo.contador}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <IconSearch size={19} color={colors.mutedLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por número, fornecedor ou descrição"
              placeholderTextColor={colors.mutedText}
              value={busca}
              onChangeText={setBusca}
              clearButtonMode="while-editing"
              accessibilityLabel="Buscar empenhos"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {tipos.map((opt) => (
              <Chip key={opt.id} label={opt.label} selected={tipo === opt.id} onPress={() => setTipo(opt.id)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsRow, styles.chipsRowTight]}>
            {situacoes.map((opt) => (
              <Chip key={opt.id} label={opt.label} selected={status === opt.id} onPress={() => setStatus(opt.id)} small />
            ))}
          </ScrollView>

          <View style={styles.resultRow}>
            <Text style={styles.resultCount}>
              {filtrados.length} {filtrados.length === 1 ? 'empenho' : 'empenhos'}
            </Text>
            <Text style={styles.resultSort}>Mais recentes primeiro</Text>
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
        data={loading || erro ? [] : filtrados}
        keyExtractor={(item) => `${item.tipo}-${item.id}`}
        renderItem={({ item }) => <EmpenhoCard item={item} onPress={setSelecionado} />}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          loading || erro ? null : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{empenhos.length === 0 ? 'Nenhum empenho encontrado' : 'Nenhum resultado'}</Text>
              <Text style={styles.emptyDesc}>
                {empenhos.length === 0 ? 'Não há empenhos cadastrados para o seu campus.' : 'Tente outro número, fornecedor ou filtro.'}
              </Text>
            </View>
          )
        }
        initialNumToRender={8}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} colors={[colors.blue]} tintColor={colors.blue} />
        }
      />
      <EmpenhoDetalheModal empenho={selecionado} onClose={() => setSelecionado(null)} />
    </>
  );
};

const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void; small?: boolean }> = ({ label, selected, onPress, small }) => (
  <TouchableOpacity
    style={[styles.chip, small && styles.chipSmall, selected && styles.chipSelected]}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.chipText, small && styles.chipTextSmall, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

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
  summarySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
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
  chipsRow: { flexDirection: 'row', gap: 7, marginTop: 14, paddingRight: 18 },
  chipsRowTight: { marginTop: 8, marginBottom: 14 },
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
  chipSmall: { minHeight: 30, paddingVertical: 5, paddingHorizontal: 11 },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 13, color: colors.tagText, fontWeight: '600' },
  chipTextSmall: { fontSize: 12 },
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
  errorCard: { backgroundColor: colors.dangerBg, borderRadius: 16, padding: 18, gap: 8, alignItems: 'flex-start' },
  errorTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  errorDesc: { fontSize: 13, lineHeight: 19, color: colors.inkLight },
  retryButton: { marginTop: 6, backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
