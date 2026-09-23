import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PortariaEventoItem } from '../types';
import { colors } from '../constants/theme';
import { IconMapPin, IconUsers, IconAlertTriangle, IconClock, IconRight } from './Icons';

interface PortariaCardProps {
  item: PortariaEventoItem;
  onPressParticipantes: () => void;
}

const formatDateTimeRange = (dataInicioStr: string, dataFimStr?: string | null) => {
  if (!dataInicioStr) return '';
  try {
    const inicio = new Date(dataInicioStr);
    const hoje = new Date();
    const isHoje =
      inicio.getDate() === hoje.getDate() &&
      inicio.getMonth() === hoje.getMonth() &&
      inicio.getFullYear() === hoje.getFullYear();

    const horaInicio = `${String(inicio.getHours()).padStart(2, '0')}:${String(
      inicio.getMinutes()
    ).padStart(2, '0')}`;

    let horaFim = '';
    if (dataFimStr) {
      const fim = new Date(dataFimStr);
      horaFim = ` - ${String(fim.getHours()).padStart(2, '0')}:${String(
        fim.getMinutes()
      ).padStart(2, '0')}`;
    }

    if (isHoje) {
      return `Hoje, ${horaInicio}${horaFim}`;
    }

    const dia = String(inicio.getDate()).padStart(2, '0');
    const mes = String(inicio.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}, ${horaInicio}${horaFim}`;
  } catch {
    return dataInicioStr;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'em_andamento':
      return { label: 'Em Andamento', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    case 'confirmado':
      return { label: 'Confirmado', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    case 'concluido':
      return { label: 'Concluído', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    case 'cancelado':
      return { label: 'Cancelado', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
    default:
      return { label: status, bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
  }
};

const getTipoBadge = (tipo: string) => {
  const map: Record<string, string> = {
    academico: 'Acadêmico',
    cultural: 'Cultural',
    esportivo: 'Esportivo',
    reuniao: 'Reunião',
    palestra: 'Palestra',
    externo: 'Comunidade Externa',
  };
  return map[tipo] || tipo;
};

export const PortariaCard: React.FC<PortariaCardProps> = ({ item, onPressParticipantes }) => {
  const statusBadge = getStatusBadge(item.status);
  const timeStr = formatDateTimeRange(item.dataInicio, item.dataFim);
  const pctPresenca =
    item.totalParticipantes > 0
      ? Math.round((item.totalPresentes / item.totalParticipantes) * 100)
      : 0;

  return (
    <View style={styles.card}>
      {/* Top Header: Tipo + Horário + Status */}
      <View style={styles.header}>
        <View style={styles.tipoContainer}>
          <Text style={styles.tipoText}>{getTipoBadge(item.tipo)}</Text>
          <View style={styles.timeBadge}>
            <IconClock size={12} color="#475569" />
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
          ]}
        >
          <Text style={[styles.statusText, { color: statusBadge.color }]}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{item.titulo}</Text>

      {/* Location */}
      <View style={styles.infoRow}>
        <IconMapPin size={15} color={colors.blue} />
        <Text style={styles.localText}>{item.local}</Text>
      </View>

      {/* Responsible */}
      {item.responsavelNome ? (
        <View style={styles.infoRow}>
          <Text style={styles.responsavelLabel}>Organizador:</Text>
          <Text style={styles.responsavelValue}>
            {item.responsavelNome}
            {item.responsavelContato ? ` • ${item.responsavelContato}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Gatehouse Instructions Alert */}
      {item.observacoesPortaria ? (
        <View style={styles.alertaPortaria}>
          <IconAlertTriangle size={15} color="#b45309" />
          <View style={styles.alertaContent}>
            <Text style={styles.alertaTitle}>Aviso da Portaria</Text>
            <Text style={styles.alertaText}>{item.observacoesPortaria}</Text>
          </View>
        </View>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer: Participantes count and View Action */}
      <View style={styles.footer}>
        <View style={styles.participantesMeta}>
          <IconUsers size={16} color={colors.ink} />
          <Text style={styles.participantesCount}>
            <Text style={styles.boldText}>{item.totalPresentes}</Text> de{' '}
            <Text style={styles.boldText}>{item.totalParticipantes}</Text> presentes ({pctPresenca}%)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onPressParticipantes}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBtnText}>Lista de Participantes</Text>
          <IconRight size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tipoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tipoText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.blue,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  localText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.blue,
  },
  responsavelLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  responsavelValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.ink,
    flexShrink: 1,
  },
  alertaPortaria: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  alertaContent: {
    flex: 1,
  },
  alertaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  alertaText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantesMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantesCount: {
    fontSize: 12,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700',
    color: colors.ink,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
