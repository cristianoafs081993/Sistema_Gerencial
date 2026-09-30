import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import type { ContratoDetalhe, ContratoItem, ContratoStatus } from '../types';
import { formatarDataIso, formatarMoeda } from '../lib/format';
import { fetchContratoDetalhe } from '../services/contratos';
import { Skeleton } from './Skeleton';

interface Props {
  contrato: ContratoItem | null;
  onClose: () => void;
}

type Aba = 'resumo' | 'empenhos' | 'faturas' | 'itens' | 'termos';

const STATUS_VISUAL: Record<ContratoStatus, { label: string; bg: string; fg: string }> = {
  vigente: { label: 'Vigente', bg: colors.greenBg, fg: colors.greenText },
  a_vencer: { label: 'A vencer', bg: colors.amberBadgeBg, fg: colors.amberText },
  expirado: { label: 'Expirado', bg: colors.dangerBg, fg: colors.danger },
};

export const ContratoDetalheModal: React.FC<Props> = ({ contrato, onClose }) => {
  const [aba, setAba] = useState<Aba>('resumo');
  const [detalhe, setDetalhe] = useState<ContratoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (uuid: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDetalhe(await fetchContratoDetalhe(uuid));
    } catch (error) {
      console.error('Erro ao carregar detalhe do contrato', error);
      setDetalhe(null);
      setErro('Não foi possível carregar os detalhes deste contrato.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!contrato) return;
    setAba('resumo');
    setDetalhe(null);
    carregar(contrato.uuid);
  }, [contrato, carregar]);

  if (!contrato) return null;

  const visual = STATUS_VISUAL[contrato.status];
  const abas: { id: Aba; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'empenhos', label: detalhe ? `Empenhos (${detalhe.empenhos.length})` : 'Empenhos' },
    { id: 'faturas', label: detalhe ? `Faturas (${detalhe.faturas.length})` : 'Faturas' },
    { id: 'itens', label: detalhe ? `Itens (${detalhe.itens.length})` : 'Itens' },
    { id: 'termos', label: detalhe ? `Termos (${detalhe.termos.length})` : 'Termos' },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Voltar para a lista">
            <Text style={styles.closeText}>‹ Contratos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroCode}>Contrato {contrato.numero}</Text>
            <View style={[styles.badge, { backgroundColor: visual.bg }]}>
              <Text style={[styles.badgeText, { color: visual.fg }]}>{visual.label}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{contrato.fornecedor}</Text>
          <Text style={styles.heroSub}>
            {contrato.vigenciaTexto} · até {formatarDataIso(contrato.vigenciaFim)}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {abas.map((item) => {
            const ativa = aba === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.tab, ativa && styles.tabActive]}
                onPress={() => setAba(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
              >
                <Text style={[styles.tabText, ativa && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {aba === 'resumo' ? <Resumo contrato={contrato} /> : null}

          {aba !== 'resumo' && carregando ? <SkeletonLista /> : null}

          {aba !== 'resumo' && erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
              <TouchableOpacity style={styles.retry} onPress={() => carregar(contrato.uuid)} accessibilityRole="button">
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {aba !== 'resumo' && detalhe && !carregando ? <Listas aba={aba} detalhe={detalhe} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const Linha: React.FC<{ label: string; valor: string; forte?: boolean }> = ({ label, valor, forte }) => (
  <View style={styles.kv}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, forte && styles.kvStrong]}>{valor}</Text>
  </View>
);

const Resumo: React.FC<{ contrato: ContratoItem }> = ({ contrato }) => (
  <View style={styles.stack}>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Execução financeira (campus)</Text>
      <Linha label="Valor global do contrato" valor={formatarMoeda(contrato.valorGlobal)} forte />
      <Linha label="Empenhado" valor={formatarMoeda(contrato.empenhado)} />
      <Linha label="A liquidar" valor={formatarMoeda(contrato.aLiquidar)} />
      <Linha label="Liquidado" valor={formatarMoeda(contrato.liquidado)} />
      <Linha label="Pago" valor={formatarMoeda(contrato.pago)} />
    </View>

    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Vigência</Text>
      <Linha label="Início" valor={formatarDataIso(contrato.vigenciaInicio)} />
      <Linha label="Término" valor={formatarDataIso(contrato.vigenciaFim)} />
      <Linha label="Situação" valor={contrato.vigenciaTexto} />
      {contrato.faturasPendentes > 0 ? (
        <Linha
          label="Faturas pendentes"
          valor={`${contrato.faturasPendentes}`}
          forte
        />
      ) : null}
    </View>

    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Objeto</Text>
      <Text style={styles.objeto}>{contrato.objeto}</Text>
      {contrato.processo ? <Linha label="Processo" valor={contrato.processo} /> : null}
      {contrato.categoria ? <Linha label="Categoria" valor={contrato.categoria} /> : null}
      {contrato.unidadeOrigem ? <Linha label="Unidade de origem" valor={contrato.unidadeOrigem} /> : null}
    </View>
  </View>
);

const SkeletonLista: React.FC = () => (
  <View style={styles.stack} accessibilityRole="progressbar" accessibilityLabel="Carregando detalhes">
    {[0, 1, 2].map((i) => (
      <View key={i} style={styles.panel}>
        <Skeleton width="45%" height={14} />
        <Skeleton height={12} style={styles.gap} />
        <Skeleton width="60%" height={12} style={styles.gap} />
      </View>
    ))}
  </View>
);

const Vazio: React.FC<{ texto: string }> = ({ texto }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{texto}</Text>
  </View>
);

const Listas: React.FC<{ aba: Exclude<Aba, 'resumo'>; detalhe: ContratoDetalhe }> = ({ aba, detalhe }) => {
  if (aba === 'empenhos') {
    if (detalhe.empenhos.length === 0) return <Vazio texto="Nenhum empenho deste contrato para o seu campus." />;
    return (
      <View style={styles.stack}>
        {detalhe.empenhos.map((e) => (
          <View key={e.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{e.numero}</Text>
              <Text style={styles.itemMeta}>{formatarDataIso(e.dataEmissao)}</Text>
            </View>
            {e.credor ? <Text style={styles.itemSub}>{e.credor}</Text> : null}
            <Linha label="Empenhado" valor={formatarMoeda(e.empenhado)} forte />
            <Linha label="A liquidar" valor={formatarMoeda(e.aLiquidar)} />
            <Linha label="Liquidado" valor={formatarMoeda(e.liquidado)} />
            <Linha label="Pago" valor={formatarMoeda(e.pago)} />
            {e.naturezaDespesa ? <Linha label="Natureza da despesa" valor={e.naturezaDespesa} /> : null}
          </View>
        ))}
      </View>
    );
  }

  if (aba === 'faturas') {
    if (detalhe.faturas.length === 0) return <Vazio texto="Nenhuma fatura registrada para este contrato." />;
    return (
      <View style={styles.stack}>
        {detalhe.faturas.map((f) => (
          <View key={f.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>Fatura {f.numero}</Text>
              <View style={[styles.pill, { backgroundColor: f.pendente ? colors.amberBadgeBg : colors.greenBg }]}>
                <Text style={[styles.pillText, { color: f.pendente ? colors.amberText : colors.greenText }]}>{f.situacao}</Text>
              </View>
            </View>
            {f.referencia !== '—' ? <Linha label="Referência" valor={f.referencia} /> : null}
            <Linha label="Valor líquido" valor={formatarMoeda(f.valorLiquido)} forte />
            <Linha label="Valor bruto" valor={formatarMoeda(f.valorBruto)} />
            <Linha label="Vencimento" valor={formatarDataIso(f.vencimento)} />
            {f.pagamento ? <Linha label="Pagamento" valor={formatarDataIso(f.pagamento)} /> : null}
          </View>
        ))}
      </View>
    );
  }

  if (aba === 'itens') {
    if (detalhe.itens.length === 0) return <Vazio texto="Este contrato não tem itens cadastrados." />;
    return (
      <View style={styles.stack}>
        {detalhe.itens.map((i) => (
          <View key={i.id} style={styles.panel}>
            {i.numeroItem ? <Text style={styles.itemMeta}>Item {i.numeroItem}</Text> : null}
            <Text style={styles.itemTitle}>{i.descricao}</Text>
            <Linha label="Quantidade" valor={i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} />
            <Linha label="Valor unitário" valor={formatarMoeda(i.valorUnitario)} />
            <Linha label="Valor total" valor={formatarMoeda(i.valorTotal)} forte />
          </View>
        ))}
      </View>
    );
  }

  if (detalhe.termos.length === 0) return <Vazio texto="Sem termos (aditivos, apostilas) registrados." />;
  return (
    <View style={styles.stack}>
      {detalhe.termos.map((t) => (
        <View key={t.id} style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>{t.tipo}</Text>
            <Text style={styles.itemMeta}>{formatarDataIso(t.assinatura)}</Text>
          </View>
          {t.numero ? <Text style={styles.itemSub}>Nº {t.numero}</Text> : null}
          <Linha label="Valor" valor={formatarMoeda(t.valor)} forte />
          <Linha label="Vigência" valor={`${formatarDataIso(t.vigenciaInicio)} → ${formatarDataIso(t.vigenciaFim)}`} />
          {t.observacao ? <Text style={styles.observacao}>{t.observacao}</Text> : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 12, paddingTop: 4, backgroundColor: colors.white },
  closeButton: { paddingVertical: 10, paddingHorizontal: 8, alignSelf: 'flex-start' },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.blue },
  hero: { backgroundColor: colors.white, paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCode: { fontSize: 13, fontWeight: '700', color: colors.muted },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  heroSub: { fontSize: 13, color: colors.muted },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  tabsScroll: { flexGrow: 0, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabs: { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.tagBg },
  tabActive: { backgroundColor: colors.blue },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.tagText },
  tabTextActive: { color: colors.white },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },
  stack: { gap: 12 },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 8 },
  panelTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, color: colors.mutedText, textTransform: 'uppercase', marginBottom: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  kvLabel: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  kvValue: { fontSize: 14, fontWeight: '600', color: colors.ink, textAlign: 'right', flexShrink: 1 },
  kvStrong: { fontSize: 15, fontWeight: '800', color: colors.ink },
  objeto: { fontSize: 14, lineHeight: 21, color: colors.inkLight },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  itemMeta: { fontSize: 12, color: colors.mutedText },
  itemSub: { fontSize: 13, color: colors.muted },
  observacao: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
  pill: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: '700' },
  gap: { marginTop: 10 },
  empty: { alignItems: 'center', padding: 28 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 16, gap: 10, alignItems: 'flex-start' },
  errorText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  retry: { backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 16 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
