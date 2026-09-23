import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PortariaEventoItem, PortariaParticipanteItem } from '../types';
import { colors } from '../constants/theme';
import {
  IconClose,
  IconSearch,
  IconUsers,
  IconCheck,
  IconCheckCheck,
  IconCar,
  IconMapPin,
} from './Icons';
import { fetchPortariaParticipantes, toggleParticipanteCheckin } from '../services/api';

interface ParticipantesModalProps {
  visible: boolean;
  evento: PortariaEventoItem | null;
  onClose: () => void;
  onAttendanceChanged?: () => void;
}

type FilterType = 'todos' | 'presentes' | 'ausentes';

export const ParticipantesModal: React.FC<ParticipantesModalProps> = ({
  visible,
  evento,
  onClose,
  onAttendanceChanged,
}) => {
  const [participantes, setParticipantes] = useState<PortariaParticipanteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('todos');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadParticipantes = useCallback(async () => {
    if (!evento) return;
    setLoading(true);
    try {
      const data = await fetchPortariaParticipantes(evento.id);
      setParticipantes(data);
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
    } finally {
      setLoading(false);
    }
  }, [evento]);

  useEffect(() => {
    if (visible && evento) {
      setSearchQuery('');
      setFilterType('todos');
      loadParticipantes();
    }
  }, [visible, evento, loadParticipantes]);

  const handleToggleCheckin = async (item: PortariaParticipanteItem) => {
    const nextState = !item.presente;
    setUpdatingId(item.id);

    // Optimistic local update
    const previous = [...participantes];
    setParticipantes((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              presente: nextState,
              horarioEntrada: nextState ? new Date().toISOString() : null,
            }
          : p
      )
    );

    const success = await toggleParticipanteCheckin(item.id, nextState);
    setUpdatingId(null);

    if (!success) {
      // Rollback
      setParticipantes(previous);
      Alert.alert('Erro', 'Não foi possível atualizar o status de presença.');
    } else {
      if (onAttendanceChanged) {
        onAttendanceChanged();
      }
    }
  };

  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredParticipantes = useMemo(() => {
    const q = normalize(searchQuery.trim());
    return participantes.filter((p) => {
      const matchesSearch =
        !q ||
        normalize(p.nome).includes(q) ||
        (p.documento && normalize(p.documento).includes(q)) ||
        (p.instituicao && normalize(p.instituicao).includes(q)) ||
        (p.veiculoPlaca && normalize(p.veiculoPlaca).includes(q));

      let matchesFilter = true;
      if (filterType === 'presentes') matchesFilter = p.presente;
      else if (filterType === 'ausentes') matchesFilter = !p.presente;

      return matchesSearch && matchesFilter;
    });
  }, [participantes, searchQuery, filterType]);

  const totalCount = participantes.length;
  const presentesCount = participantes.filter((p) => p.presente).length;
  const ausentesCount = totalCount - presentesCount;

  const formatHorario = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '';
    }
  };

  if (!visible || !evento) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderInfo}>
            <Text style={styles.headerSubtitle}>Portaria / Controle de Acesso</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {evento.titulo}
            </Text>
            <View style={styles.headerLocation}>
              <IconMapPin size={13} color={colors.blue} />
              <Text style={styles.headerLocationText}>{evento.local}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <IconClose size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSearch size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar participante, documento ou placa..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconClose size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterPill, filterType === 'todos' && styles.filterPillActive]}
            onPress={() => setFilterType('todos')}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'todos' && styles.filterPillTextActive,
              ]}
            >
              Todos ({totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterType === 'presentes' && styles.filterPillActive]}
            onPress={() => setFilterType('presentes')}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'presentes' && styles.filterPillTextActive,
              ]}
            >
              Presentes ({presentesCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterType === 'ausentes' && styles.filterPillActive]}
            onPress={() => setFilterType('ausentes')}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'ausentes' && styles.filterPillTextActive,
              ]}
            >
              Ausentes ({ausentesCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.loadingText}>Carregando lista de participantes...</Text>
          </View>
        ) : filteredParticipantes.length === 0 ? (
          <View style={styles.centerContainer}>
            <IconUsers size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Nenhum participante encontrado</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Tente ajustar os termos de busca.'
                : 'Não há participantes cadastrados para este filtro.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredParticipantes.map((item) => {
              const isUpdating = updatingId === item.id;
              const entradaStr = formatHorario(item.horarioEntrada);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.participantCard,
                    item.presente && styles.participantCardPresente,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.nameBlock}>
                      <Text style={styles.participantName}>{item.nome}</Text>
                      <View style={styles.badgesRow}>
                        {item.tipo ? (
                          <Text style={styles.roleBadge}>{item.tipo.toUpperCase()}</Text>
                        ) : null}
                        {item.instituicao ? (
                          <Text style={styles.instText}>{item.instituicao}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Check-in Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.checkinBtn,
                        item.presente ? styles.checkinBtnPresente : styles.checkinBtnPendente,
                      ]}
                      onPress={() => handleToggleCheckin(item)}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      {isUpdating ? (
                        <ActivityIndicator
                          size="small"
                          color={item.presente ? '#047857' : '#ffffff'}
                        />
                      ) : item.presente ? (
                        <>
                          <IconCheckCheck size={16} color="#047857" />
                          <Text style={styles.checkinBtnTextPresente}>
                            {entradaStr ? `Entrada: ${entradaStr}` : 'Presente'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <IconCheck size={16} color="#ffffff" />
                          <Text style={styles.checkinBtnTextPendente}>Registrar Entrada</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Secondary Info: Document + License Plate */}
                  <View style={styles.detailsRow}>
                    {item.documento ? (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Doc:</Text>
                        <Text style={styles.metaValue}>{item.documento}</Text>
                      </View>
                    ) : null}

                    {item.veiculoPlaca ? (
                      <View style={styles.plateContainer}>
                        <IconCar size={14} color="#1e293b" />
                        <Text style={styles.plateText}>{item.veiculoPlaca}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Observação / Instruções Específicas */}
                  {item.observacao ? (
                    <Text style={styles.obsText}>Obs: {item.observacao}</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topHeaderInfo: {
    flex: 1,
    paddingRight: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  headerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  headerLocationText: {
    fontSize: 12,
    color: colors.blue,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: colors.blue,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  participantCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  participantCardPresente: {
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  nameBlock: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  instText: {
    fontSize: 11,
    color: '#64748b',
  },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
  },
  checkinBtnPendente: {
    backgroundColor: colors.blue,
  },
  checkinBtnPresente: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  checkinBtnTextPendente: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  checkinBtnTextPresente: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: '600',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  obsText: {
    fontSize: 11,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
  },
});
