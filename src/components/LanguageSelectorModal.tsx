import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';
import { SttLanguageMode } from '../types';

interface LanguageOption {
  id: SttLanguageMode;
  title: string;
  nativeTitle: string;
  description: string;
  badge?: string;
  badgeType?: 'primary' | 'neutral';
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'ur',
    title: 'Urdu',
    nativeTitle: 'اردو',
    description: 'Transcribes speech strictly in Urdu Nastaliq script. Hindi/Devanagari is completely blocked.',
    badge: 'Recommended / پاکستان',
    badgeType: 'primary',
  },
  {
    id: 'en',
    title: 'English',
    nativeTitle: 'English Only',
    description: 'Transcribes speech strictly in English text.',
    badge: 'Standard',
    badgeType: 'neutral',
  },
  {
    id: 'auto',
    title: 'Auto Bilingual',
    nativeTitle: 'اردو + English',
    description: 'Mixed Urdu and English speech. Any Hindi misidentifications are automatically converted to Urdu.',
    badge: 'Bilingual',
    badgeType: 'neutral',
  },
];

interface LanguageSelectorModalProps {
  visible: boolean;
  selectedLanguage: SttLanguageMode;
  onSelectLanguage: (mode: SttLanguageMode) => void;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  selectedLanguage,
  onSelectLanguage,
  onClose,
}) => {
  const handleSelect = (mode: SttLanguageMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectLanguage(mode);
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Listening Language</Text>
              <Text style={styles.headerSubtitle}>
                Restrict transcription to Urdu, English, or Bilingual
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close language selector"
            >
              <Ionicons name="close" size={24} color={THEME.colors.textPrimary} />
            </Pressable>
          </View>

          {/* Options List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = opt.id === selectedLanguage;

              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                  ]}
                  onPress={() => handleSelect(opt.id)}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${opt.title}, ${opt.description}`}
                >
                  <View style={styles.info}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, isSelected && styles.titleSelected]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.nativeTitle}>
                        ({opt.nativeTitle})
                      </Text>
                      {opt.badge && (
                        <View
                          style={[
                            styles.badge,
                            opt.badgeType === 'primary' && styles.badgePrimary,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              opt.badgeType === 'primary' && styles.badgeTextPrimary,
                            ]}
                          >
                            {opt.badge}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.description}>
                      {opt.description}
                    </Text>
                  </View>

                  {/* Radio Checkmark */}
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#001E2C" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginVertical: THEME.spacing.sm,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: THEME.colors.conversationAccent,
    backgroundColor: '#16233B',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  titleSelected: {
    color: THEME.colors.conversationAccent,
  },
  nativeTitle: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgePrimary: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextPrimary: {
    color: THEME.colors.conversationAccent,
  },
  description: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: THEME.colors.conversationAccent,
    backgroundColor: THEME.colors.conversationAccent,
  },
});
