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
  OcorrenciaItem,
  EnergiaFaturaItem,
  EnergiaSolarItem,
  PortariaEventoItem,
  InfraSubTab,
  ManutencaoFilter,
  PortariaFilter,
  EnergiaFilter,
} from '../types';
import { IconWrench, IconZap, IconSearch, IconUsers } from '../components/Icons';
import { OcorrenciaCard } from '../components/OcorrenciaCard';
import { EnergiaCard } from '../components/EnergiaCard';
import { PortariaCard } from '../components/PortariaCard';
import { ParticipantesModal } from '../components/ParticipantesModal';
import {
  fetchOcorrencias,
  fetchEnergiaFaturas,
  fetchEnergiaSolar,
  fetchPortariaEventos,
} from '../services/api';

type CombinedEnergiaItem =
  | { type: 'fatura'; id: string; fatura: EnergiaFaturaItem; solar?: undefined }
  | { type: 'solar'; id: string; solar: EnergiaSolarItem; fatura?: undefined };

export const InfraestruturaScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<InfraSubTab>('portaria');
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaItem[]>([]);
  const [eventos, setEventos] = useState<PortariaEventoItem[]>([]);
  const [faturas, setFaturas] = useState<EnergiaFaturaItem[]>([]);
  const [solar, setSolar] = useState<EnergiaSolarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [manutencaoFilter, setManutencaoFilter] = useState<ManutencaoFilter>('all');
  const [portariaFilter, setPortariaFilter] = useState<PortariaFilter>('todos');
  const [energiaFilter, setEnergiaFilter] = useState<EnergiaFilter>('all');

  // Modal de participantes
  const [selectedEvento, setSelectedEvento] = useState<PortariaEventoItem | null>(null);
  const [modalParticipantesVisible, setModalParticipantesVisible] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [oData, eData, fData, sData] = await Promise.all([
        fetchOcorrencias(),
        fetchPortariaEventos(),
        fetchEnergiaFaturas(),
        fetchEnergiaSolar(),
      ]);
      setOcorrencias(oData);
      setEventos(eData);
      setFaturas(fData);
      setSolar(sData);
    } catch (err) {
      console.error('Erro ao carregar dados de infraestrutura:', err);
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

  // Filtered Ocorrências
  const filteredOcorrencias = useMemo(() => {
    const q = normalize(searchQuery.trim());
    return ocorrencias.filter((item) => {
      const matchesSearch =
        !q ||
        normalize(item.ambienteNome).includes(q) ||
        normalize(item.ambienteCodigo).includes(q) ||
        (item.bloco && normalize(item.bloco).includes(q)) ||
        (item.observacao && normalize(item.observacao).includes(q)) ||
        item.problemas.some((p) => normalize(p).includes(q));

      let matchesFilter = true;
      if (manutencaoFilter === 'pendente') {
        matchesFilter = item.status === 'pendente';
      } else if (manutencaoFilter === 'em_andamento') {
        matchesFilter = item.status === 'em_andamento';
      } else if (manutencaoFilter === 'resolvido') {
        matchesFilter = item.status === 'resolvido';
      }

      return matchesSearch && matchesFilter;
    });
  }, [ocorrencias, searchQuery, manutencaoFilter]);

  // Filtered Eventos Portaria
  const filteredEventos = useMemo(() => {
    const q = normalize(searchQuery.trim());
    const hoje = new Date();
    const hojeDay = hoje.getDate();
    const hojeMonth = hoje.getMonth();
    const hojeYear = hoje.getFullYear();

    return eventos.filter((item) => {
      const matchesSearch =
        !q ||
        normalize(item.titulo).includes(q) ||
        normalize(item.local).includes(q) ||
        (item.responsavelNome && normalize(item.responsavelNome).includes(q)) ||
        (item.observacoesPortaria && normalize(item.observacoesPortaria).includes(q)) ||
        normalize(item.tipo).includes(q);

      let matchesFilter = true;
      if (portariaFilter === 'hoje') {
        try {
          const d = new Date(item.dataInicio);
          matchesFilter =
            d.getDate() === hojeDay && d.getMonth() === hojeMonth && d.getFullYear() === hojeYear;
        } catch {
          matchesFilter = true;
        }
      } else if (portariaFilter === 'futuros') {
        try {
          const d = new Date(item.dataInicio);
          const startOfTomorrow = new Date(hojeYear, hojeMonth, hojeDay + 1);
          matchesFilter = d >= startOfTomorrow;
        } catch {
          matchesFilter = true;
        }
      }

      return matchesSearch && matchesFilter;
    });
  }, [eventos, searchQuery, portariaFilter]);

  // Filtered Energia Items
  const filteredEnergiaItems: CombinedEnergiaItem[] = useMemo(() => {
    const q = normalize(searchQuery.trim());

    const faturaMatches: CombinedEnergiaItem[] = faturas
      .filter((f) => {
        const matchesSearch =
          !q ||
          normalize(f.competencia).includes(q) ||
          (f.fornecedor && normalize(f.fornecedor).includes(q)) ||
          (f.faturaNumero && normalize(f.faturaNumero).includes(q)) ||
          normalize(f.fonte).includes(q);

        let matchesFilter = true;
        if (energiaFilter === 'cosern') matchesFilter = f.fonte === 'cosern';
        else if (energiaFilter === 'mercatto') matchesFilter = f.fonte === 'mercatto';
        else if (energiaFilter === 'solar') matchesFilter = false;

        return matchesSearch && matchesFilter;
      })
      .map((f) => ({ type: 'fatura' as const, id: `fatura-${f.id}`, fatura: f }));

    const solarMatches: CombinedEnergiaItem[] = solar
      .filter((s) => {
        const matchesSearch =
          !q ||
          normalize(s.ufvNome).includes(q) ||
          normalize(s.dataReferencia).includes(q) ||
          String(s.ano).includes(q);

        let matchesFilter = true;
        if (energiaFilter === 'cosern' || energiaFilter === 'mercatto') matchesFilter = false;

        return matchesSearch && matchesFilter;
      })
      .map((s) => ({ type: 'solar' as const, id: `solar-${s.id}`, solar: s }));

    return [...faturaMatches, ...solarMatches];
  }, [faturas, solar, searchQuery, energiaFilter]);

  // KPI Metrics Manutenção
  const kpiManutencao = useMemo(() => {
    const total = ocorrencias.length;
    const pendentes = ocorrencias.filter((o) => o.status === 'pendente').length;
    const emAndamento = ocorrencias.filter((o) => o.status === 'em_andamento').length;
    const resolvidos = ocorrencias.filter((o) => o.status === 'resolvido').length;
    return { total, pendentes, emAndamento, resolvidos };
  }, [ocorrencias]);

  // KPI Metrics Portaria
  const kpiPortaria = useMemo(() => {
    const totalEventos = eventos.length;
    const hoje = new Date();
    const hojeDay = hoje.getDate();
    const hojeMonth = hoje.getMonth();
    const hojeYear = hoje.getFullYear();

    const eventosHoje = eventos.filter((e) => {
      try {
        const d = new Date(e.dataInicio);
        return d.getDate() === hojeDay && d.getMonth() === hojeMonth && d.getFullYear() === hojeYear;
      } catch {
        return false;
      }
    });

    const totalParticipantes = eventos.reduce((acc, e) => acc + (e.totalParticipantes || 0), 0);
    const totalPresentes = eventos.reduce((acc, e) => acc + (e.totalPresentes || 0), 0);
    const pctPresenca =
      totalParticipantes > 0 ? Math.round((totalPresentes / totalParticipantes) * 100) : 0;

    return {
      totalEventos,
      eventosHoje: eventosHoje.length,
      totalParticipantes,
      totalPresentes,
      pctPresenca,
    };
  }, [eventos]);

  // KPI Metrics Energia
  const kpiEnergia = useMemo(() => {
    const consumoTotalKwh = faturas.reduce((acc, f) => acc + (f.consumoKwh || 0), 0);
    const valorTotal = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const geracaoSolarTotalKwh = solar.reduce((acc, s) => acc + (s.energiaGeradaKwh || 0), 0);
    return { consumoTotalKwh, valorTotal, geracaoSolarTotalKwh };
  }, [faturas, solar]);

  return (
    <View style={styles.container}>
      {/* Sub-Tabs: Manutenção / Portaria / Energia */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, subTab === 'manutencao' && styles.tabButtonActive]}
          onPress={() => {
            setSubTab('manutencao');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <IconWrench
            size={16}
            color={subTab === 'manutencao' ? colors.blue : colors.muted}
            strokeWidth={2}
          />
          <Text
            style={[styles.tabButtonText, subTab === 'manutencao' && styles.tabButtonTextActive]}
          >
            Manutenção ({ocorrencias.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, subTab === 'portaria' && styles.tabButtonActive]}
          onPress={() => {
            setSubTab('portaria');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <IconUsers
            size={16}
            color={subTab === 'portaria' ? colors.blue : colors.muted}
            strokeWidth={2}
          />
          <Text
            style={[styles.tabButtonText, subTab === 'portaria' && styles.tabButtonTextActive]}
          >
            Portaria ({eventos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, subTab === 'energia' && styles.tabButtonActive]}
          onPress={() => {
            setSubTab('energia');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <IconZap
            size={16}
            color={subTab === 'energia' ? colors.blue : colors.muted}
            strokeWidth={2}
          />
          <Text
            style={[styles.tabButtonText, subTab === 'energia' && styles.tabButtonTextActive]}
          >
            Energia ({faturas.length + solar.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSearch size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              subTab === 'manutencao'
                ? 'Buscar por ambiente, bloco ou problema...'
                : subTab === 'portaria'
                ? 'Buscar evento, local ou organizador...'
                : 'Buscar por competência, fornecedor...'
            }
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {subTab === 'manutencao' ? (
            <>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  manutencaoFilter === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setManutencaoFilter('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    manutencaoFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Todas ({kpiManutencao.total})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  manutencaoFilter === 'pendente' && styles.filterChipActive,
                ]}
                onPress={() => setManutencaoFilter('pendente')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    manutencaoFilter === 'pendente' && styles.filterChipTextActive,
                  ]}
                >
                  Pendentes ({kpiManutencao.pendentes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  manutencaoFilter === 'em_andamento' && styles.filterChipActive,
                ]}
                onPress={() => setManutencaoFilter('em_andamento')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    manutencaoFilter === 'em_andamento' && styles.filterChipTextActive,
                  ]}
                >
                  Em andamento ({kpiManutencao.emAndamento})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  manutencaoFilter === 'resolvido' && styles.filterChipActive,
                ]}
                onPress={() => setManutencaoFilter('resolvido')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    manutencaoFilter === 'resolvido' && styles.filterChipTextActive,
                  ]}
                >
                  Resolvidas ({kpiManutencao.resolvidos})
                </Text>
              </TouchableOpacity>
            </>
          ) : subTab === 'portaria' ? (
            <>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  portariaFilter === 'todos' && styles.filterChipActive,
                ]}
                onPress={() => setPortariaFilter('todos')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    portariaFilter === 'todos' && styles.filterChipTextActive,
                  ]}
                >
                  Todos ({kpiPortaria.totalEventos})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  portariaFilter === 'hoje' && styles.filterChipActive,
                ]}
                onPress={() => setPortariaFilter('hoje')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    portariaFilter === 'hoje' && styles.filterChipTextActive,
                  ]}
                >
                  Hoje ({kpiPortaria.eventosHoje})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  portariaFilter === 'futuros' && styles.filterChipActive,
                ]}
                onPress={() => setPortariaFilter('futuros')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    portariaFilter === 'futuros' && styles.filterChipTextActive,
                  ]}
                >
                  Próximos Dias ({Math.max(0, kpiPortaria.totalEventos - kpiPortaria.eventosHoje)})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.filterChip, energiaFilter === 'all' && styles.filterChipActive]}
                onPress={() => setEnergiaFilter('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    energiaFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Todos ({faturas.length + solar.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, energiaFilter === 'cosern' && styles.filterChipActive]}
                onPress={() => setEnergiaFilter('cosern')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    energiaFilter === 'cosern' && styles.filterChipTextActive,
                  ]}
                >
                  COSERN ({faturas.filter((f) => f.fonte === 'cosern').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, energiaFilter === 'mercatto' && styles.filterChipActive]}
                onPress={() => setEnergiaFilter('mercatto')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    energiaFilter === 'mercatto' && styles.filterChipTextActive,
                  ]}
                >
                  Mercatto ({faturas.filter((f) => f.fonte === 'mercatto').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, energiaFilter === 'solar' && styles.filterChipActive]}
                onPress={() => setEnergiaFilter('solar')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    energiaFilter === 'solar' && styles.filterChipTextActive,
                  ]}
                >
                  Solar ({solar.length})
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.loadingText}>Carregando dados de infraestrutura...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.blue}
              colors={[colors.blue]}
            />
          }
        >
          {/* KPI Summary Cards */}
          {subTab === 'manutencao' ? (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Pendentes</Text>
                  <Text style={[styles.kpiValue, { color: '#b45309' }]}>
                    {kpiManutencao.pendentes}
                  </Text>
                </View>

                <View style={[styles.kpiCard, { borderLeftColor: colors.blue, borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Em Andamento</Text>
                  <Text style={[styles.kpiValue, { color: colors.blue }]}>
                    {kpiManutencao.emAndamento}
                  </Text>
                </View>

                <View style={[styles.kpiCard, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Resolvidas</Text>
                  <Text style={[styles.kpiValue, { color: '#047857' }]}>
                    {kpiManutencao.resolvidos}
                  </Text>
                </View>
              </View>
            </View>
          ) : subTab === 'portaria' ? (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { borderLeftColor: colors.blue, borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Eventos Hoje</Text>
                  <Text style={[styles.kpiValue, { color: colors.blue }]}>
                    {kpiPortaria.eventosHoje}
                  </Text>
                </View>

                <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6', borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Participantes</Text>
                  <Text style={[styles.kpiValue, { color: '#6d28d9' }]}>
                    {kpiPortaria.totalParticipantes}
                  </Text>
                </View>

                <View style={[styles.kpiCard, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
                  <Text style={styles.kpiLabel}>Presenças</Text>
                  <Text style={[styles.kpiValue, { color: '#047857' }]}>
                    {kpiPortaria.totalPresentes} ({kpiPortaria.pctPresenca}%)
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Consumo Total</Text>
                  <Text style={styles.kpiValue}>
                    {kpiEnergia.consumoTotalKwh > 1000000
                      ? `${(kpiEnergia.consumoTotalKwh / 1000).toFixed(0)} MWh`
                      : `${kpiEnergia.consumoTotalKwh.toLocaleString('pt-BR')} kWh`}
                  </Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Valor Faturado</Text>
                  <Text style={[styles.kpiValue, { color: colors.blue }]}>
                    {formatBRL(kpiEnergia.valorTotal)}
                  </Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Geração Solar</Text>
                  <Text style={[styles.kpiValue, { color: '#b45309' }]}>
                    {kpiEnergia.geracaoSolarTotalKwh.toLocaleString('pt-BR')} kWh
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* List or Empty State */}
          {subTab === 'manutencao' ? (
            filteredOcorrencias.length === 0 ? (
              <View style={styles.emptyState}>
                <IconWrench size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>Nenhuma ocorrência encontrada</Text>
                <Text style={styles.emptySubtitle}>
                  Tente alterar os filtros ou o termo pesquisado.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsWrapper}>
                {filteredOcorrencias.map((item) => (
                  <OcorrenciaCard key={item.id} item={item} />
                ))}
              </View>
            )
          ) : subTab === 'portaria' ? (
            filteredEventos.length === 0 ? (
              <View style={styles.emptyState}>
                <IconUsers size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>Nenhum evento agendado</Text>
                <Text style={styles.emptySubtitle}>
                  Não há eventos cadastrados para o período selecionado.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsWrapper}>
                {filteredEventos.map((item) => (
                  <PortariaCard
                    key={item.id}
                    item={item}
                    onPressParticipantes={() => {
                      setSelectedEvento(item);
                      setModalParticipantesVisible(true);
                    }}
                  />
                ))}
              </View>
            )
          ) : filteredEnergiaItems.length === 0 ? (
            <View style={styles.emptyState}>
              <IconZap size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Nenhum registro de energia encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Tente alterar os filtros ou o termo pesquisado.
              </Text>
            </View>
          ) : (
            <View style={styles.itemsWrapper}>
              {filteredEnergiaItems.map((item) => (
                <EnergiaCard
                  key={item.id}
                  fatura={item.fatura}
                  solar={item.solar}
                  type={item.type}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal de Participantes */}
      <ParticipantesModal
        visible={modalParticipantesVisible}
        evento={selectedEvento}
        onClose={() => {
          setModalParticipantesVisible(false);
          setSelectedEvento(null);
        }}
        onAttendanceChanged={() => loadData(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.blue,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  tabButtonTextActive: {
    color: colors.blue,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 0,
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: colors.blueNavActive,
    borderColor: colors.blue,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.blue,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  itemsWrapper: {
    paddingHorizontal: 16,
  },
  kpiContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
});
