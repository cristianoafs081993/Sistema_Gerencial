import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../constants/theme';
import { formatBRL } from '../constants/data';
import { EmpenhoItem, EmpenhoFilter } from '../types';
import { IconCalendar, IconSearch } from '../components/Icons';
import { EmpenhoCard } from '../components/EmpenhoCard';
import { fetchEmpenhos } from '../services/api';

export const EmpenhosScreen: React.FC = () => {
  const [empenhos, setEmpenhos] = useState<EmpenhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<EmpenhoFilter>('all');

  const loadEmpenhos = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchEmpenhos();
      setEmpenhos(data);
    } catch (err) {
      console.error('Erro ao carregar empenhos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEmpenhos();
  }, [loadEmpenhos]);

  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredEmpenhos = useMemo(() => {
    const q = normalize(searchQuery.trim());
    return empenhos.filter((item) => {
      const matchesSearch =
        !q ||
        normalize(item.id).includes(q) ||
        normalize(item.name).includes(q) ||
        normalize(item.desc).includes(q);

      const matchesFilter =
        activeFilter === 'all' || item.tipo === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [empenhos, searchQuery, activeFilter]);

  const summarySum = useMemo(() => {
    return filteredEmpenhos.reduce((acc, curr) => acc + curr.value, 0);
  }, [filteredEmpenhos]);

  const summaryLabel = useMemo(() => {
    if (activeFilter === 'exercicio') return 'Empenhado no exercício';
    if (activeFilter === 'rap') return 'Restos a pagar (RAP)';
    return 'Total de empenhos';
  }, [activeFilter]);

  const filterOptions: { id: EmpenhoFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'exercicio', label: 'Exercício' },
    { id: 'rap', label: 'Restos a pagar' },
  ];

  if (loading && empenhos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Carregando empenhos do Supabase...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadEmpenhos(true)}
          colors={[colors.blue]}
          tintColor={colors.blue}
        />
      }
    >
      {/* Title Row */}
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>Empenhos</Text>
        <View style={styles.yearBadge}>
          <IconCalendar size={14} color="#51627b" />
          <Text style={styles.yearText}>2026</Text>
        </View>
      </View>

      <Text style={styles.listIntro}>Do compromisso ao pagamento.</Text>

      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>{summaryLabel}</Text>
          <Text style={styles.summaryValue}>
            {formatBRL(summarySum, false)}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryLabel}>Empenhos</Text>
          <Text style={[styles.summaryValue, { color: colors.blue }]}>
            {filteredEmpenhos.length}
          </Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchBox}>
        <IconSearch size={19} color="#8b97aa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar número ou fornecedor"
          placeholderTextColor="#7c899d"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsContainer}>
        {filterOptions.map((opt) => {
          const isSelected = activeFilter === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => setActiveFilter(opt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Result Counter Row */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          {filteredEmpenhos.length}{' '}
          {filteredEmpenhos.length === 1 ? 'empenho' : 'empenhos'} na listagem
        </Text>
        <Text style={styles.resultSort}>Mais recentes</Text>
      </View>

      {/* List / Empty State */}
      {filteredEmpenhos.length > 0 ? (
        filteredEmpenhos.map((item) => (
          <EmpenhoCard key={item.id} item={item} />
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhum resultado</Text>
          <Text style={styles.emptyDesc}>
            Tente outro número, fornecedor ou filtro.
          </Text>
        </View>
      )}

      {/* Footer Note */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerNote}>
          Exibindo registros reais de empenhos do campus ({empenhos.length} no total).
        </Text>
        <Text style={styles.footerNote}>
          Sincronizado diretamente com a base de dados do SIAFI/Supabase.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  titleText: {
    fontSize: 27,
    letterSpacing: -1,
    fontWeight: '700',
    color: colors.ink,
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  yearText: {
    fontSize: 12,
    color: '#51627b',
    fontWeight: '500',
  },
  listIntro: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 21,
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    padding: 17,
    marginBottom: 19,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryRight: {
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    paddingLeft: 20,
    alignItems: 'flex-end',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.ink,
    marginTop: 7,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineInput,
    paddingHorizontal: 13,
    borderRadius: 12,
    minHeight: 47,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    marginBottom: 19,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  chipText: {
    fontSize: 12,
    color: '#67778f',
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultCount: {
    fontSize: 12,
    color: colors.muted,
  },
  resultSort: {
    fontSize: 12,
    color: colors.muted,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c8d2e2',
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  footerNote: {
    textAlign: 'center',
    color: '#7f8ba0',
    fontSize: 12,
    lineHeight: 20,
  },
});
