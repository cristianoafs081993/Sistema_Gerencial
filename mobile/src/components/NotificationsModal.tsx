import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../constants/theme';
import { formatBRL } from '../constants/data';
import { NotificationItem, NotificationType } from '../types';
import {
  IconBell,
  IconReceipt,
  IconLandmark,
  IconSend,
  IconCheckCheck,
  IconCalendar,
} from './Icons';

type TabFilter = 'all' | NotificationType;

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  loading?: boolean;
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onNavigateToEmpenhos: () => void;
}

const formatDatePtBR = (date?: Date | null): string => {
  if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getStatusBadge = (type: NotificationType, status?: string) => {
  if (type === 'descentralizacao') {
    return {
      label: 'NC',
      bg: '#ecfdf5',
      text: '#059669',
      border: '#a7f3d0',
    };
  }
  if (type === 'requisicao') {
    return {
      label: 'Enviada',
      bg: '#fffbeb',
      text: '#b45309',
      border: '#fde68a',
    };
  }
  const s = (status || 'pendente').toLowerCase();
  if (s === 'liquidado') {
    return { label: 'Liquidado', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
  }
  if (s === 'pago') {
    return { label: 'Pago', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
  }
  if (s === 'cancelado') {
    return { label: 'Cancelado', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
  }
  return { label: 'Pendente', bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  notifications,
  loading = false,
  unreadCount,
  onMarkAllAsRead,
  onNavigateToEmpenhos,
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      empenho: notifications.filter((n) => n.type === 'empenho').length,
      descentralizacao: notifications.filter((n) => n.type === 'descentralizacao').length,
      requisicao: notifications.filter((n) => n.type === 'requisicao').length,
    };
  }, [notifications]);

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
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={styles.iconCircle}>
                    <IconBell size={18} color={colors.blue} />
                  </View>
                  <View>
                    <View style={styles.titleWithBadge}>
                      <Text style={styles.title}>Notificações</Text>
                      {unreadCount > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>
                            {unreadCount > 99 ? '99+' : unreadCount} nova{unreadCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.subtitle}>Últimos eventos da plataforma web</Text>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      onPress={onMarkAllAsRead}
                      style={styles.markReadBtn}
                      activeOpacity={0.7}
                    >
                      <IconCheckCheck size={15} color={colors.blue} />
                      <Text style={styles.markReadText}>Lidas</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tabsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabsScroll}
                >
                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
                    onPress={() => setActiveTab('all')}
                  >
                    <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                      Todas ({counts.all})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'empenho' && styles.tabItemActive]}
                    onPress={() => setActiveTab('empenho')}
                  >
                    <Text style={[styles.tabText, activeTab === 'empenho' && styles.tabTextActive]}>
                      Empenhos ({counts.empenho})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'descentralizacao' && styles.tabItemActive]}
                    onPress={() => setActiveTab('descentralizacao')}
                  >
                    <Text style={[styles.tabText, activeTab === 'descentralizacao' && styles.tabTextActive]}>
                      Descentralizações ({counts.descentralizacao})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'requisicao' && styles.tabItemActive]}
                    onPress={() => setActiveTab('requisicao')}
                  >
                    <Text style={[styles.tabText, activeTab === 'requisicao' && styles.tabTextActive]}>
                      Requisições ({counts.requisicao})
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.blue} />
                  <Text style={styles.loadingText}>Carregando notificações...</Text>
                </View>
              ) : filteredNotifications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Nenhum evento encontrado</Text>
                  <Text style={styles.emptySubtitle}>
                    Não há movimentações recentes para a categoria selecionada.
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                  {filteredNotifications.map((item) => {
                    const badge = getStatusBadge(item.type, item.status);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.card}
                        activeOpacity={item.type === 'empenho' ? 0.7 : 1}
                        onPress={() => {
                          if (item.type === 'empenho') {
                            onClose();
                            onNavigateToEmpenhos();
                          }
                        }}
                      >
                        <View style={styles.cardTopRow}>
                          <View
                            style={[
                              styles.cardIcon,
                              item.type === 'empenho' ? { backgroundColor: '#eff6ff' } : 
                              item.type === 'descentralizacao' ? { backgroundColor: '#ecfdf5' } : 
                              { backgroundColor: '#fffbeb' },
                            ]}
                          >
                            {item.type === 'empenho' ? (
                              <IconReceipt size={17} color="#2563eb" />
                            ) : item.type === 'descentralizacao' ? (
                              <IconLandmark size={17} color="#059669" />
                            ) : (
                              <IconSend size={16} color="#d97706" />
                            )}
                          </View>

                          <View style={styles.cardMainInfo}>
                            <View style={styles.cardTitleLine}>
                              <Text style={styles.cardDocTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <View
                                style={[
                                  styles.badgeBox,
                                  { backgroundColor: badge.bg, borderColor: badge.border },
                                ]}
                              >
                                <Text style={[styles.badgeText, { color: badge.text }]}>
                                  {badge.label}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.cardSubtitle} numberOfLines={1}>
                              {item.subtitle}
                            </Text>

                            {Boolean(item.description) && (
                              <Text style={styles.cardDescription} numberOfLines={2}>
                                {item.description}
                              </Text>
                            )}

                            <View style={styles.cardFooter}>
                              <Text style={styles.cardValue}>{formatBRL(item.valor)}</Text>
                              <View style={styles.cardFooterRight}>
                                {Boolean(item.dimensao) && (
                                  <View style={styles.dimensaoTag}>
                                    <Text style={styles.dimensaoText} numberOfLines={1}>
                                      {item.dimensao!.split(' - ')[0] || item.dimensao}
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.dateTag}>
                                  <IconCalendar size={11} color="#94a3b8" />
                                  <Text style={styles.dateText}>
                                    {formatDatePtBR(item.documentDate || item.date)}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {item.type === 'empenho' && (
                              <Text style={styles.tapTip}>Toque para ver em Empenhos →</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
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
    paddingTop: 16,
    paddingBottom: 26,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '700',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabItemActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.muted,
  },
  emptyBox: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardMainInfo: {
    flex: 1,
  },
  cardTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardDocTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
  },
  badgeBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dimensaoTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dimensaoText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#334155',
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateText: {
    fontSize: 10,
    color: '#64748b',
  },
  tapTip: {
    fontSize: 10,
    color: colors.blue,
    fontWeight: '600',
    marginTop: 5,
  },
});

