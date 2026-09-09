import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors } from '../constants/theme';
import { IconBell, IconShield, IconChart, IconDoc } from './Icons';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToContratos: () => void;
  onNavigateToDashboard: () => void;
  contratosAVencerCount?: number;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  onNavigateToContratos,
  onNavigateToDashboard,
  contratosAVencerCount = 11,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={styles.iconCircle}>
                    <IconBell size={18} color={colors.blue} />
                  </View>
                  <Text style={styles.title}>Notificações</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{contratosAVencerCount}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Notification List */}
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {/* Notification Item 1 - Contratos a Vencer */}
                <View style={[styles.card, styles.cardWarning]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: '#fff1f2' }]}>
                      <IconShield size={16} color="#e11d48" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>Contratos com Vencimento Próximo</Text>
                      <Text style={styles.cardTime}>Atenção prioritária</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>
                    {contratosAVencerCount}{' '}
                    {contratosAVencerCount === 1
                      ? 'contrato no Campus Currais Novos possui término de vigência previsto para os próximos 30 dias.'
                      : 'contratos no Campus Currais Novos possuem término de vigência previstos para os próximos 30 dias.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => {
                      onClose();
                      onNavigateToContratos();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardActionText}>Ver contratos a vencer →</Text>
                  </TouchableOpacity>
                </View>

                {/* Notification Item 2 - Orçamento do Exercício */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: colors.blueBg }]}>
                      <IconChart size={16} color={colors.blue} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>Execução Orçamentária 2026</Text>
                      <Text style={styles.cardTime}>Exercício atual</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>
                    O campus já empenhou 92,9% do recurso descentralizado (R$ 2.402.115,00 de R$ 2.584.624,00). Restam R$ 182.509,00 disponíveis.
                  </Text>
                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionSecondary]}
                    onPress={() => {
                      onClose();
                      onNavigateToDashboard();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cardActionText, { color: colors.blue }]}>Ver métricas no dashboard →</Text>
                  </TouchableOpacity>
                </View>

                {/* Notification Item 3 - Restos a Pagar */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: '#fef3c7' }]}>
                      <IconDoc size={16} color="#d97706" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>Restos a Pagar (RAP)</Text>
                      <Text style={styles.cardTime}>Acompanhamento</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>
                    R$ 87.819,00 encontram-se liquidados a pagar no exercício de 2026 para fornecedores do campus.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  countBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  list: {
    marginTop: 14,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardWarning: {
    backgroundColor: '#fffafb',
    borderColor: '#fed7aa',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  cardTime: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  cardBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardActionBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  cardActionSecondary: {
    backgroundColor: colors.blueBg,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
