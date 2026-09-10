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
import {
  PregaoItem,
  AtaItem,
  LicitacaoSubTab,
  PregaoFilter,
  AtaFilter,
} from '../types';
import { IconGavel, IconDoc, IconSearch } from '../components/Icons';
import { PregaoCard } from '../components/PregaoCard';
import { AtaCard } from '../components/AtaCard';
import { fetchPregoes, fetchAtas } from '../services/api';

export const LicitacoesScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<LicitacaoSubTab>('pregoes');
  const [pregoes, setPregoes] = useState<PregaoItem[]>([]);
  const [atas, setAtas] = useState<AtaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [pregaoFilter, setPregaoFilter] = useState<PregaoFilter>('all');
  const [ataFilter, setAtaFilter] = useState<AtaFilter>('all');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [pData, aData] = await Promise.all([
        fetchPregoes(),
        fetchAtas(),
      ]);
      setPregoes(pData);
      setAtas(aData);
    } catch (err) {
      console.error('Erro ao carregar dados de licitações:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Filtered Pregões
  const filteredPregoes = useMemo(() => {
    const q = normalize(searchQuery.trim());
    return pregoes.filter((item) => {
      const matchesSearch =
        !q ||
        normalize(item.numero).includes(q) ||
        normalize(item.objeto).includes(q) ||
        normalize(item.uasgNome).includes(q) ||
        normalize(item.uasgCodigo).includes(q);

      let matchesFilter = true;
      if (pregaoFilter === 'abertas') {
        matchesFilter = item.statusProposta === 'Aberta';
      } else if (pregaoFilter === 'encerradas') {
        matchesFilter = item.statusProposta === 'Encerrada';
      } else if (pregaoFilter === 'srp') {
        matchesFilter = item.srp;
      }

      return matchesSearch && matchesFilter;
    });
  }, [pregoes, searchQuery, pregaoFilter]);

  // Filtered Atas
  const filteredAtas = useMemo(() => {
    const q = normalize(searchQuery.trim());
    return atas.filter((item) => {
      const matchesSearch =
        !q ||
        normalize(item.numeroAta).includes(q) ||
        (item.numeroCompra && normalize(item.numeroCompra).includes(q)) ||
        normalize(item.objeto).includes(q) ||
        normalize(item.unidadeGerenciadoraNome).includes(q);

      let matchesFilter = true;
      if (ataFilter === 'vigentes') {
        matchesFilter = item.statusVigencia === 'vigente';
      } else if (ataFilter === 'vencer') {
        matchesFilter = item.statusVigencia === 'vencer';
      } else if (ataFilter === 'campus') {
        matchesFilter =
          item.vinculo === 'gerenciadora' ||
          item.vinculo === 'participante' ||
          item.vinculo === 'aderente';
      }

      return matchesSearch && matchesFilter;
    });
  }, [atas, searchQuery, ataFilter]);

  // Pregões metrics
  const totalValorPregoes = useMemo(() => {
    return pregoes.reduce((acc, curr) => acc + curr.valor, 0);
  }, [pregoes]);

  const pregoesAbertosCount = useMemo(() => {
    return pregoes.filter((p) => p.statusProposta === 'Aberta').length;
  }, [pregoes]);

  // Atas metrics
  const atasVigentesCount = useMemo(() => {
    return atas.filter((a) => a.statusVigencia === 'vigente').length;
  }, [atas]);

  const atasAVencerCount = useMemo(() => {
    return atas.filter((a) => a.statusVigencia === 'vencer').length;
  }, [atas]);

  const pregaoFilterOptions: { id: PregaoFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'abertas', label: 'Propostas abertas' },
    { id: 'encerradas', label: 'Encerradas' },
    { id: 'srp', label: 'Somente SRP' },
  ];

  const ataFilterOptions: { id: AtaFilter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'vigentes', label: 'Vigentes' },
    { id: 'vencer', label: 'A vencer' },
    { id: 'campus', label: 'Campus Currais Novos' },
  ];

  if (loading && pregoes.length === 0 && atas.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Carregando licitações e atas...</Text>
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
          onRefresh={() => loadData(true)}
          colors={[colors.blue]}
          tintColor={colors.blue}
        />
      }
    >
      {/* Title Row */}
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>Licitações</Text>
        <View style={styles.campusBadge}>
          <IconGavel size={14} color="#51627b" />
          <Text style={styles.campusBadgeText}>PNCP / Compras</Text>
        </View>
      </View>

      <Text style={styles.listIntro}>
        Pregões eletrônicos e atas de registro de preços integrados.
      </Text>

      {/* Segmented Switcher */}
      <View style={styles.switcherContainer}>
        <TouchableOpacity
          style={[
            styles.switchButton,
            subTab === 'pregoes' && styles.switchButtonActive,
          ]}
          onPress={() => {
            setSubTab('pregoes');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <IconGavel
            size={16}
            color={subTab === 'pregoes' ? colors.blue : '#64748b'}
          />
          <Text
            style={[
              styles.switchButtonText,
              subTab === 'pregoes' && styles.switchButtonTextActive,
            ]}
          >
            Pregões ({pregoes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.switchButton,
            subTab === 'atas' && styles.switchButtonActive,
          ]}
          onPress={() => {
            setSubTab('atas');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <IconDoc
            size={16}
            color={subTab === 'atas' ? colors.blue : '#64748b'}
          />
          <Text
            style={[
              styles.switchButtonText,
              subTab === 'atas' && styles.switchButtonTextActive,
            ]}
          >
            Atas ({atas.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content depending on subTab */}
      {subTab === 'pregoes' ? (
        <>
          {/* Summary Strip for Pregões */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>Total homologado / estimado</Text>
              <Text style={styles.summaryValue}>
                {formatBRL(totalValorPregoes, false)}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Abertos</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: pregoesAbertosCount > 0 ? colors.greenText : colors.blue },
                ]}
              >
                {pregoesAbertosCount}
              </Text>
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <IconSearch size={19} color="#8b97aa" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar pregão, objeto ou UASG"
              placeholderTextColor="#7c899d"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filter Chips */}
          <View style={styles.chipsContainer}>
            {pregaoFilterOptions.map((opt) => {
              const isSelected = pregaoFilter === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setPregaoFilter(opt.id)}
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
              {filteredPregoes.length}{' '}
              {filteredPregoes.length === 1 ? 'pregão' : 'pregões'} na listagem
            </Text>
            <Text style={styles.resultSort}>Mais recentes</Text>
          </View>

          {/* List or Empty */}
          {filteredPregoes.length > 0 ? (
            filteredPregoes.map((item) => (
              <PregaoCard key={item.id} item={item} />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum pregão encontrado</Text>
              <Text style={styles.emptyDesc}>
                Tente outro número, termo de busca ou filtro.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Summary Strip for Atas */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>Atas cadastradas</Text>
              <Text style={styles.summaryValue}>{atas.length}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Vigentes / A vencer</Text>
              <Text style={[styles.summaryValue, { color: colors.blue }]}>
                {atasVigentesCount}{' '}
                <Text style={{ fontSize: 13, color: colors.amberText }}>
                  ({atasAVencerCount} a vencer)
                </Text>
              </Text>
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <IconSearch size={19} color="#8b97aa" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar ata, compra ou objeto"
              placeholderTextColor="#7c899d"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filter Chips */}
          <View style={styles.chipsContainer}>
            {ataFilterOptions.map((opt) => {
              const isSelected = ataFilter === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setAtaFilter(opt.id)}
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
              {filteredAtas.length}{' '}
              {filteredAtas.length === 1 ? 'ata' : 'atas'} na listagem
            </Text>
            <Text style={styles.resultSort}>Vigência</Text>
          </View>

          {/* List or Empty */}
          {filteredAtas.length > 0 ? (
            filteredAtas.map((item) => <AtaCard key={item.id} item={item} />)
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhuma ata encontrada</Text>
              <Text style={styles.emptyDesc}>
                Tente outro número de ata, compra ou filtro.
              </Text>
            </View>
          )}
        </>
      )}

      {/* Footer Note */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerNote}>
          Dados sincronizados com o Portal Nacional de Contratações Públicas
          (PNCP) e Compras.gov.br via Supabase.
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
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  campusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#eceff5',
  },
  campusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#51627b',
  },
  listIntro: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
  },
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#edf2f7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  switchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 9,
    gap: 6,
  },
  switchButtonActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  switchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  switchButtonTextActive: {
    color: colors.blue,
    fontWeight: '700',
  },
  summaryStrip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  chipTextSelected: {
    color: colors.white,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  resultSort: {
    fontSize: 12,
    color: colors.mutedText,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 11,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 16,
  },
});
