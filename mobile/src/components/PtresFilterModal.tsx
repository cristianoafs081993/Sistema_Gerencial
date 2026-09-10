import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { colors } from '../constants/theme';
import { PtresItem } from '../types';
import { IconFilter, IconCheck, IconClose, IconSearch } from './Icons';

interface PtresFilterModalProps {
  visible: boolean;
  onClose: () => void;
  options: PtresItem[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

export const PtresFilterModal: React.FC<PtresFilterModalProps> = ({
  visible,
  onClose,
  options,
  selectedCode,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.code.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      (item.shortLabel && item.shortLabel.toLowerCase().includes(term))
    );
  });

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <IconFilter size={18} color={colors.blue} />
              </View>
              <View>
                <Text style={styles.title}>Origem de Recurso / PTRES</Text>
                <Text style={styles.subtitle}>
                  Filtre as métricas do painel por recurso
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <IconClose size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Search box if options > 5 */}
          {options.length > 5 && (
            <View style={styles.searchBox}>
              <IconSearch size={16} color="#8b97aa" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar código ou descrição do PTRES..."
                placeholderTextColor="#7c899d"
                value={searchTerm}
                onChangeText={setSearchTerm}
                clearButtonMode="while-editing"
              />
            </View>
          )}

          {/* List of PTRES options */}
          <ScrollView
            style={styles.optionsList}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredOptions.map((item) => {
              const isSelected = item.code === selectedCode;
              const isAll = item.code === 'all';

              return (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => handleSelect(item.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.codeBadge,
                        isSelected && styles.codeBadgeSelected,
                        isAll && styles.codeBadgeAll,
                      ]}
                    >
                      <Text
                        style={[
                          styles.codeText,
                          isSelected && styles.codeTextSelected,
                        ]}
                      >
                        {item.code === 'all' ? 'TODOS' : item.code}
                      </Text>
                    </View>

                    <View style={styles.labelBox}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.code !== 'all' && (
                        <Text style={styles.optionDesc}>
                          Origem orçamentária · PTRES {item.code}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.checkIconBox}>
                      <IconCheck size={17} color={colors.blue} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer note */}
          <View style={styles.footerNoteBox}>
            <Text style={styles.footerNoteText}>
              Os valores e gráficos serão recalculados instantaneamente de acordo com a origem selecionada.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
  },
  optionsList: {
    maxHeight: 380,
  },
  optionsContent: {
    gap: 8,
    paddingVertical: 4,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  optionItemSelected: {
    borderColor: colors.blue,
    backgroundColor: '#f4f7ff',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  codeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#eef2f6',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  codeBadgeSelected: {
    backgroundColor: '#ecf1ff',
    borderColor: colors.blue,
  },
  codeBadgeAll: {
    backgroundColor: '#f1f5f9',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  codeTextSelected: {
    color: colors.blue,
  },
  labelBox: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTitleSelected: {
    color: colors.blue,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  checkIconBox: {
    marginLeft: 8,
  },
  footerNoteBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 15,
  },
});
