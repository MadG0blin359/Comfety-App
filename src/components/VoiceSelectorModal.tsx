import React, { useState } from 'react';
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
import { TtsVoicePreset } from '../types';
import { TTS_VOICE_PRESETS, speakText, stopSpeech } from '../services/ttsManager';

interface VoiceSelectorModalProps {
  visible: boolean;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  onClose: () => void;
}

export const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  visible,
  selectedVoiceId,
  onSelectVoice,
  onClose,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handleSelect = (preset: TtsVoicePreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopSpeech();
    setPlayingVoiceId(null);
    onSelectVoice(preset.id);
  };

  const handlePreview = (preset: TtsVoicePreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayingVoiceId(preset.id);

    speakText(preset.samplePhrase, {
      voiceId: preset.id,
      onDone: () => setPlayingVoiceId(null),
      onError: () => setPlayingVoiceId(null),
    });
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopSpeech();
    setPlayingVoiceId(null);
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
              <Text style={styles.headerTitle}>Select Speaking Voice</Text>
              <Text style={styles.headerSubtitle}>
                Choose your natural on-device speaking profile
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close voice selector"
            >
              <Ionicons name="close" size={24} color={THEME.colors.textPrimary} />
            </Pressable>
          </View>

          {/* Voice Presets List */}
          <ScrollView
            style={styles.voiceList}
            contentContainerStyle={styles.voiceListContent}
            showsVerticalScrollIndicator={false}
          >
            {TTS_VOICE_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedVoiceId;
              const isPlaying = playingVoiceId === preset.id;

              return (
                <Pressable
                  key={preset.id}
                  style={[
                    styles.voiceCard,
                    isSelected && styles.voiceCardSelected,
                  ]}
                  onPress={() => handleSelect(preset)}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${preset.name}, ${preset.regionLabel}, ${preset.gender}`}
                >
                  <View style={styles.voiceInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]}>
                        {preset.name}
                      </Text>
                      <View style={styles.genderBadge}>
                        <Text style={styles.genderText}>
                          {preset.gender === 'female' ? 'Female' : 'Male'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.regionLabel}>{preset.regionLabel}</Text>
                    <Text style={styles.samplePreview} numberOfLines={1} ellipsizeMode="tail">
                      &ldquo;{preset.samplePhrase}&rdquo;
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    {/* Audio Preview Button */}
                    <Pressable
                      style={[styles.previewButton, isPlaying && styles.previewButtonActive]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePreview(preset);
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Listen to sample for ${preset.name}`}
                    >
                      <Ionicons
                        name={isPlaying ? 'volume-high' : 'play-outline'}
                        size={18}
                        color={isPlaying ? '#001E2C' : THEME.colors.conversationAccent}
                      />
                    </Pressable>

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
    borderTopWidth: 1,
    borderColor: '#334155',
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceList: {
    marginTop: 12,
  },
  voiceListContent: {
    gap: 10,
    paddingBottom: 20,
  },
  voiceCard: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceCardSelected: {
    borderColor: THEME.colors.conversationAccent,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  voiceInfo: {
    flex: 1,
    paddingRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceName: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  voiceNameSelected: {
    color: THEME.colors.conversationAccent,
  },
  genderBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  genderText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  regionLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  samplePreview: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonActive: {
    backgroundColor: THEME.colors.conversationAccent,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: THEME.colors.conversationAccent,
    backgroundColor: THEME.colors.conversationAccent,
  },
});
