import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { EmpenhosScreen } from './EmpenhosScreen';
import { DescentralizacoesScreen } from './DescentralizacoesScreen';
import { CreditoScreen } from './CreditoScreen';

export type OrcamentoSection = 'empenhos' | 'descentralizacoes' | 'credito';

const LABELS: Record<OrcamentoSection, string> = {
  empenhos: 'Empenhos',
  descentralizacoes: 'Descentraliz.',
  credito: 'Crédito',
};

// Nome completo para leitores de tela (o rótulo curto cabe no seletor).
const NOMES: Record<OrcamentoSection, string> = {
  empenhos: 'Empenhos',
  descentralizacoes: 'Descentralizações',
  credito: 'Crédito disponível',
};

interface Props {
  /** Seções liberadas ao usuário (na ordem de exibição). */
  sections: OrcamentoSection[];
}

/** Módulo Orçamentário além do Dashboard: Empenhos, Descentralizações e Crédito disponível. */
export const OrcamentoScreen: React.FC<Props> = ({ sections }) => {
  const [section, setSection] = useState<OrcamentoSection>(sections[0]);

  useEffect(() => {
    if (!sections.includes(section)) setSection(sections[0]);
  }, [sections, section]);

  return (
    <View style={styles.container}>
      {sections.length > 1 ? (
        <View style={styles.segmentedWrap}>
          <View style={styles.segmented} accessibilityRole="tablist">
            {sections.map((item) => {
              const ativo = item === section;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.segment, ativo && styles.segmentActive]}
                  onPress={() => setSection(item)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityLabel={NOMES[item]}
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.segmentText, ativo && styles.segmentTextActive]} numberOfLines={1}>
                    {LABELS[item]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.content}>
        {section === 'empenhos' ? <EmpenhosScreen /> : null}
        {section === 'descentralizacoes' ? <DescentralizacoesScreen /> : null}
        {section === 'credito' ? <CreditoScreen /> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  segmentedWrap: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4, backgroundColor: colors.bg },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.progressBg,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: colors.white, boxShadow: '0 1px 3px rgba(30, 80, 140, 0.15)' },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  segmentTextActive: { color: colors.blue, fontWeight: '800' },
});
