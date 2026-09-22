import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { OcorrenciaItem } from '../types';
import { colors } from '../constants/theme';
import { IconClock, IconCheck, IconAlertTriangle } from './Icons';

interface OcorrenciaCardProps {
  item: OcorrenciaItem;
}

const problemLabels: Record<string, string> = {
  falta_papel_higienico: 'Falta Papel Higiênico',
  falta_papel_toalha: 'Falta Papel Toalha',
  falta_sabonete: 'Falta Sabonete',
  lixeira_cheia: 'Lixeira Cheia',
  vazamento: 'Vazamento Hidráulico',
  mau_cheiro: 'Mau Cheiro / Odor',
  ar_condicionado: 'Ar Condicionado',
  lampada_queimada: 'Lâmpada / Elétrica',
  limpeza_geral: 'Limpeza Pesada',
  sujeira_piso: 'Piso Sujo',
  sujeira: 'Limpeza',
};

const formatDate = (isoString: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${mins}`;
  } catch {
    return isoString;
  }
};

export const OcorrenciaCard: React.FC<OcorrenciaCardProps> = ({ item }) => {
  const getStatusBadge = () => {
    switch (item.status) {
      case 'pendente':
        return {
          label: 'Pendente',
          bg: '#fef3c7',
          color: '#b45309',
          borderColor: '#fde68a',
        };
      case 'em_andamento':
        return {
          label: 'Em andamento',
          bg: '#eff6ff',
          color: '#1d4ed8',
          borderColor: '#bfdbfe',
        };
      case 'resolvido':
        return {
          label: 'Resolvido',
          bg: '#ecfdf5',
          color: '#047857',
          borderColor: '#a7f3d0',
        };
      default:
        return {
          label: 'Arquivado',
          bg: '#f1f5f9',
          color: '#64748b',
          borderColor: '#cbd5e1',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <View style={styles.card}>
      {/* Top Header: Ambiente and Status */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.ambienteNome} numberOfLines={1}>
            {item.ambienteNome}
          </Text>
          <View style={styles.metaRow}>
            {item.bloco && (
              <View style={styles.blocoBadge}>
                <Text style={styles.blocoText}>Bloco {item.bloco}</Text>
              </View>
            )}
            <Text style={styles.ambienteCodigo}>{item.ambienteCodigo}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusBadge.bg, borderColor: statusBadge.borderColor },
          ]}
        >
          <Text style={[styles.statusText, { color: statusBadge.color }]}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      {/* Problems chips */}
      {item.problemas.length > 0 && (
        <View style={styles.problemsContainer}>
          {item.problemas.map((prob, idx) => (
            <View key={idx} style={styles.probChip}>
              <IconAlertTriangle size={12} color="#b45309" strokeWidth={2} />
              <Text style={styles.probChipText}>
                {problemLabels[prob] || prob.replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Observação */}
      {item.observacao ? (
        <View style={styles.obsBox}>
          <Text style={styles.obsText} numberOfLines={2}>
            "{item.observacao}"
          </Text>
        </View>
      ) : null}

      {/* Foto Preview if available */}
      {item.fotoUrl ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.fotoUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Footer info: Date and Rating */}
      <View style={styles.footer}>
        <View style={styles.dateContainer}>
          <IconClock size={13} color={colors.muted} />
          <Text style={styles.dateText}>{formatDate(item.data)}</Text>
        </View>

        {item.avaliacao > 0 && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {item.avaliacao}/5</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  ambienteNome: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blocoBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blocoText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  ambienteCodigo: {
    fontSize: 11,
    color: colors.muted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  problemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  probChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  probChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
  },
  obsBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 10,
  },
  obsText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },
  imageContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    height: 120,
    backgroundColor: '#f1f5f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: colors.muted,
  },
  ratingBadge: {
    backgroundColor: '#fef9c3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854d0e',
  },
});
