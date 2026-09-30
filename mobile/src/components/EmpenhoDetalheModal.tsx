import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import type { EmpenhoItem } from '../types';
import { formatarMoeda } from '../lib/format';
import { visualDoEmpenho } from './EmpenhoCard';

interface Props {
  empenho: EmpenhoItem | null;
  onClose: () => void;
}

const Linha: React.FC<{ label: string; valor: string; forte?: boolean }> = ({ label, valor, forte }) => (
  <View style={styles.kv}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, forte && styles.kvStrong]}>{valor}</Text>
  </View>
);

export const EmpenhoDetalheModal: React.FC<Props> = ({ empenho, onClose }) => {
  if (!empenho) return null;

  const isRap = empenho.tipo === 'rap';
  const visual = visualDoEmpenho(empenho);
  const base = isRap ? empenho.inscrito ?? empenho.value : empenho.value;
  const liquidado = empenho.liquidado ?? 0;
  const pago = empenho.paid;
  const percentPago = base > 0 ? Math.min(100, Math.round((pago / base) * 100)) : 100;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Voltar para a lista">
            <Text style={styles.closeText}>‹ Empenhos</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroCode}>{empenho.id}</Text>
              <View style={[styles.badge, { backgroundColor: visual.bg }]}>
                <Text style={[styles.badgeText, { color: visual.fg }]}>{empenho.label}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{empenho.name}</Text>
            <Text style={styles.heroValue}>{formatarMoeda(isRap ? empenho.saldo ?? empenho.value : empenho.value)}</Text>
            <Text style={styles.heroCaption}>{isRap ? 'Saldo atual do resto a pagar' : 'Valor empenhado'}</Text>

            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${percentPago}%`, backgroundColor: visual.bar }]} />
            </View>
            <Text style={styles.heroCaption}>{percentPago}% pago</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Execução financeira</Text>
            {isRap ? (
              <>
                <Linha label="Inscrito / reinscrito" valor={formatarMoeda(base)} forte />
                <Linha label="Liquidado no ano" valor={formatarMoeda(liquidado)} />
                <Linha label="Pago" valor={formatarMoeda(pago)} />
                <Linha label="Saldo atual" valor={formatarMoeda(empenho.saldo ?? 0)} forte />
              </>
            ) : (
              <>
                <Linha label="Empenhado" valor={formatarMoeda(empenho.value)} forte />
                <Linha label="A liquidar" valor={formatarMoeda(empenho.saldo ?? Math.max(0, empenho.value - liquidado))} />
                <Linha label="Liquidado" valor={formatarMoeda(liquidado)} />
                <Linha label="A pagar (liquidado − pago)" valor={formatarMoeda(Math.max(0, liquidado - pago))} />
                <Linha label="Pago" valor={formatarMoeda(pago)} forte />
              </>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Descrição</Text>
            <Text style={styles.description}>{empenho.desc}</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Dados do empenho</Text>
            <Linha label="Tipo" valor={isRap ? 'Restos a pagar' : 'Exercício'} />
            <Linha label="Data" valor={empenho.date} />
            <Linha label="Natureza da despesa" valor={empenho.nd} />
            {empenho.planoInterno ? <Linha label="Plano interno" valor={empenho.planoInterno} /> : null}
            {empenho.origem ? <Linha label="Origem do recurso" valor={empenho.origem} /> : null}
            {empenho.processo ? <Linha label="Processo" valor={empenho.processo} /> : null}
          </View>
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
  hero: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 18, gap: 6 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCode: { fontSize: 13, fontWeight: '800', color: colors.muted },
  heroTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  heroValue: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2, color: colors.ink, marginTop: 8 },
  heroCaption: { fontSize: 12.5, color: colors.muted },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '800' },
  barBg: { height: 6, backgroundColor: colors.progressBg, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 3 },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 9 },
  panelTitle: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.5, color: colors.mutedText, textTransform: 'uppercase' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  kvLabel: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  kvValue: { fontSize: 14, fontWeight: '600', color: colors.ink, textAlign: 'right', flexShrink: 1 },
  kvStrong: { fontSize: 15, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 21, color: colors.inkLight },
});
