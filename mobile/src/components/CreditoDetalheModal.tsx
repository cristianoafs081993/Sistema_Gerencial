import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import { formatarDataIso, formatarMoeda } from '../lib/format';
import type { CreditoLinha } from '../lib/orcamentoRules';
import { fetchMovimentacoesPtres } from '../services/orcamento';
import { Skeleton } from './Skeleton';

interface Props {
  linha: CreditoLinha | null;
  onClose: () => void;
}

type Movimentacoes = Awaited<ReturnType<typeof fetchMovimentacoesPtres>>;

const Linha: React.FC<{ label: string; valor: string; forte?: boolean }> = ({ label, valor, forte }) => (
  <View style={styles.kv}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, forte && styles.kvStrong]}>{valor}</Text>
  </View>
);

/** Detalhe de uma linha do relatório de crédito: empenhos do ano e descentralizações do PTRES. */
export const CreditoDetalheModal: React.FC<Props> = ({ linha, onClose }) => {
  const [dados, setDados] = useState<Movimentacoes | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (ptres: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await fetchMovimentacoesPtres(ptres));
    } catch (error) {
      console.error('Erro ao carregar movimentações do PTRES', error);
      setDados(null);
      setErro('Não foi possível carregar as movimentações deste PTRES.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!linha) return;
    setDados(null);
    carregar(linha.ptres);
  }, [linha, carregar]);

  if (!linha) return null;

  const empenhado = dados?.empenhos.reduce((soma, e) => soma + e.valor, 0) ?? 0;
  const descentralizado = dados?.descentralizacoes.reduce((soma, d) => soma + d.valor, 0) ?? 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Voltar para a lista">
            <Text style={styles.closeText}>‹ Crédito disponível</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroCode}>
              PTRES {linha.ptres}
              {linha.planoInterno ? ` · PI ${linha.planoInterno}` : ''}
            </Text>
            <Text style={styles.heroTitle}>{linha.descricao || 'Sem descrição'}</Text>
            <Text style={styles.heroValue}>{formatarMoeda(linha.valor)}</Text>
            <Text style={styles.heroCaption}>Crédito disponível nesta linha do relatório</Text>
          </View>

          {carregando ? (
            <View style={styles.stack} accessibilityRole="progressbar" accessibilityLabel="Carregando movimentações">
              {[0, 1].map((i) => (
                <View key={i} style={styles.panel}>
                  <Skeleton width="50%" height={14} />
                  <Skeleton height={12} />
                  <Skeleton width="70%" height={12} />
                </View>
              ))}
            </View>
          ) : null}

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
              <TouchableOpacity style={styles.retry} onPress={() => carregar(linha.ptres)} accessibilityRole="button">
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {dados && !carregando ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Movimentação do PTRES {linha.ptres}</Text>
                <Linha label="Descentralizado" valor={formatarMoeda(descentralizado)} />
                <Linha label="Empenhado no exercício" valor={formatarMoeda(empenhado)} forte />
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Empenhos do exercício ({dados.empenhos.length})</Text>
                {dados.empenhos.length === 0 ? <Text style={styles.vazio}>Nenhum empenho neste PTRES.</Text> : null}
                {dados.empenhos.slice(0, 40).map((e) => (
                  <View key={e.id} style={styles.item}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle}>{e.numero}</Text>
                      <Text style={styles.itemValue}>{formatarMoeda(e.valor, false)}</Text>
                    </View>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {e.favorecido}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {formatarDataIso(e.data)} · Liquidado {formatarMoeda(e.liquidado, false)} · Pago {formatarMoeda(e.pago, false)}
                    </Text>
                  </View>
                ))}
                {dados.empenhos.length > 40 ? <Text style={styles.vazio}>Mostrando os 40 mais recentes.</Text> : null}
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Descentralizações ({dados.descentralizacoes.length})</Text>
                {dados.descentralizacoes.length === 0 ? <Text style={styles.vazio}>Nenhuma descentralização neste PTRES.</Text> : null}
                {dados.descentralizacoes.slice(0, 40).map((d) => (
                  <View key={d.id} style={styles.item}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle}>{formatarDataIso(d.data)}</Text>
                      <Text style={[styles.itemValue, d.valor < 0 && { color: colors.danger }]}>{formatarMoeda(d.valor, false)}</Text>
                    </View>
                    {d.descricao ? (
                      <Text style={styles.itemSub} numberOfLines={2}>
                        {d.descricao}
                      </Text>
                    ) : null}
                    {d.notaCredito ? <Text style={styles.itemMeta}>NC {d.notaCredito}</Text> : null}
                  </View>
                ))}
                {dados.descentralizacoes.length > 40 ? <Text style={styles.vazio}>Mostrando as 40 mais recentes.</Text> : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 12, paddingTop: 4, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  closeButton: { paddingVertical: 10, paddingHorizontal: 8, alignSelf: 'flex-start' },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.blue },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32, gap: 12 },
  stack: { gap: 12 },
  hero: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 18, gap: 6 },
  heroCode: { fontSize: 13, fontWeight: '800', color: colors.muted },
  heroTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  heroValue: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2, color: colors.tealText, marginTop: 6 },
  heroCaption: { fontSize: 12.5, color: colors.muted },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 9 },
  panelTitle: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.5, color: colors.mutedText, textTransform: 'uppercase' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvLabel: { fontSize: 13, color: colors.muted },
  kvValue: { fontSize: 14, fontWeight: '600', color: colors.ink },
  kvStrong: { fontSize: 15, fontWeight: '800' },
  vazio: { fontSize: 13, color: colors.muted },
  item: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, gap: 3 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  itemValue: { fontSize: 14, fontWeight: '800', color: colors.blue },
  itemSub: { fontSize: 12.5, color: colors.inkLight },
  itemMeta: { fontSize: 11.5, color: colors.mutedText },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 16, gap: 10, alignItems: 'flex-start' },
  errorText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  retry: { backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 16 },
  retryText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
