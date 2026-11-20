import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Keyboard,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../src/constants/theme';
import { useAudioChunker } from '../src/hooks/useAudioChunker';
import { QuickReplyItem } from '../src/types';
import {
  DEFAULT_QUICK_REPLIES,
  loadCustomPhrases,
  addCustomPhrase,
  deleteCustomPhrase,
} from '../src/constants/quickReplies';
import {
  TTS_VOICE_PRESETS,
  DEFAULT_VOICE_ID,
  loadSelectedVoiceId,
  saveSelectedVoiceId,
  speakText,
  stopSpeech,
} from '../src/services/ttsManager';
import { CounterDisplayModal } from '../src/components/CounterDisplayModal';
import { VoiceSelectorModal } from '../src/components/VoiceSelectorModal';
import { SavePhraseModal } from '../src/components/SavePhraseModal';

export default function ConversationScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const {
    isRecording,
    isTranscribing,
    meterLevel,
    currentDb,
    transcripts,
    error,
    startRecording,
    stopRecording,
    pauseForTts,
    resumeAfterTts,
    clearTranscripts,
    addUserReply,
  } = useAudioChunker({ enabled: true });

  // Phase 3 State: Voice selection, quick replies, typed response, modals
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [customPhrases, setCustomPhrases] = useState<QuickReplyItem[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  // Modal visibility states
  const [counterModalVisible, setCounterModalVisible] = useState<boolean>(false);
  const [counterModalText, setCounterModalText] = useState<string>('');
  const [voiceModalVisible, setVoiceModalVisible] = useState<boolean>(false);
  const [savePhraseModalVisible, setSavePhraseModalVisible] = useState<boolean>(false);

  // Dynamic keyboard tracking for fail-safe Android and iOS input positioning
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load persisted voice & custom phrases on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const voiceId = await loadSelectedVoiceId();
      const phrases = await loadCustomPhrases();
      if (isMounted) {
        setSelectedVoiceId(voiceId);
        setCustomPhrases(phrases);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-scroll to bottom when new transcript items arrive
  useEffect(() => {
    if (transcripts.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcripts]);

  // Active voice preset metadata
  const currentVoice =
    TTS_VOICE_PRESETS.find((v) => v.id === selectedVoiceId) ?? TTS_VOICE_PRESETS[0];

  // Combined quick replies: Custom phrases first, then defaults
  const allQuickReplies: QuickReplyItem[] = [...customPhrases, ...DEFAULT_QUICK_REPLIES];

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopSpeech();
    stopRecording();
    router.replace('/?select=true');
  }, [stopRecording, router]);

  // Intercept Android hardware/gesture back press to return to mode selection instead of quitting app
  useEffect(() => {
    const onHardwareBack = () => {
      handleBack();
      return true; // Prevent default app exit
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => {
      backSubscription.remove();
      stopSpeech();
    };
  }, [handleBack]);

  const toggleRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearTranscripts();
  };

  /**
   * Vocalizes text via on-device expo-speech in the current selected voice
   * with zero latency and automatic echo prevention.
   */
  const handleSpeakAloud = useCallback(
    (textToSpeak: string, logAsUserBubble = false) => {
      const trimmed = textToSpeak.trim();
      if (!trimmed) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (logAsUserBubble) {
        addUserReply(trimmed);
      }

      speakText(trimmed, {
        voiceId: selectedVoiceId,
        onStart: () => {
          pauseForTts();
          setIsSpeaking(true);
        },
        onDone: () => {
          setIsSpeaking(false);
          resumeAfterTts();
        },
        onError: () => {
          setIsSpeaking(false);
          resumeAfterTts();
        },
      });
    },
    [selectedVoiceId, pauseForTts, resumeAfterTts, addUserReply]
  );

  /**
   * Handles quick reply chip tap: instant zero-delay vocalization in current voice + transcript logging.
   */
  const handleQuickReplyPress = (reply: QuickReplyItem) => {
    handleSpeakAloud(reply.spokenText, true);
  };

  /**
   * Handles custom phrase long-press to allow deletion.
   */
  const handleQuickReplyLongPress = (reply: QuickReplyItem) => {
    if (!reply.isCustom) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Saved Phrase',
      `Remove "${reply.spokenText}" from your quick-reply tray?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await deleteCustomPhrase(reply.id);
              setCustomPhrases(updated);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              console.warn('[Conversation] Failed to delete phrase:', err);
            }
          },
        },
      ]
    );
  };

  /**
   * Vocalizes custom typed input text, logs it to feed in current selected voice, and resets input field.
   */
  const handleSendTypedReply = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    handleSpeakAloud(trimmed, true);
    setInputText('');
  };

  /**
   * Opens the full-screen 40px Counter Display Card.
   */
  const handleOpenCounterDisplay = (textToShow: string) => {
    const trimmed = textToShow.trim();
    if (!trimmed) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCounterModalText(trimmed);
    setCounterModalVisible(true);
  };

  /**
   * Persists selected voice and updates state.
   */
  const handleSelectVoice = async (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    setVoiceModalVisible(false);
    await saveSelectedVoiceId(voiceId);
  };

  /**
   * Saves a new custom phrase and adds it to the quick replies.
   */
  const handleSaveCustomPhrase = async (phraseText: string) => {
    const updated = await addCustomPhrase(phraseText);
    setCustomPhrases(updated);
  };

  const isKeyboardOpen = keyboardHeight > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Clean Uncluttered Header: Title on Left/Center, Single Voice Pill on Right */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          accessibilityHint="Stops recording and returns to home screen"
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Conversation
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            Live Bilingual Speech
          </Text>
        </View>

        {/* Single Voice Selector Pill (Clean, Spacious & Highly Visible) */}
        <Pressable
          style={styles.voiceSelectorPill}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setVoiceModalVisible(true);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Voice: ${currentVoice.name}. Tap to change speaking voice.`}
        >
          <Ionicons name="mic-circle" size={20} color={THEME.colors.conversationAccent} />
          <Text style={styles.voiceSelectorText} numberOfLines={1}>
            {currentVoice.name}
          </Text>
          <Ionicons name="chevron-down" size={14} color={THEME.colors.textSecondary} />
        </Pressable>
      </View>

      {/* Unified Acoustic & Audio State Bar (Status + RMS Visualizer + dB Readout) */}
      <View style={styles.meterContainer}>
        {/* Live Status Pill: Moved out of header to eliminate visual clutter */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isSpeaking
                ? 'rgba(168, 85, 247, 0.2)'
                : isTranscribing
                ? 'rgba(56, 189, 248, 0.2)'
                : isRecording
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isSpeaking
                  ? '#A855F7'
                  : isTranscribing
                  ? THEME.colors.conversationAccent
                  : isRecording
                  ? THEME.colors.safe
                  : THEME.colors.danger,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isSpeaking
                  ? '#C084FC'
                  : isTranscribing
                  ? THEME.colors.conversationAccent
                  : isRecording
                  ? THEME.colors.safe
                  : THEME.colors.danger,
              },
            ]}
            numberOfLines={1}
          >
            {isSpeaking
              ? 'Speaking'
              : isTranscribing
              ? 'Transcribing'
              : isRecording
              ? 'Listening'
              : 'Paused'}
          </Text>
        </View>

        {/* Real-time RMS Decibel Meter Track */}
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                width: isRecording ? `${Math.round(meterLevel * 100)}%` : '0%',
                backgroundColor:
                  meterLevel > 0.4 ? THEME.colors.conversationAccent : 'rgba(56, 189, 248, 0.5)',
              },
            ]}
          />
        </View>

        {/* Decibel Numerical Readout */}
        <Text style={styles.meterLabel}>
          {!isRecording ? 'Off' : meterLevel > 0.15 ? `${Math.round(currentDb)} dB` : 'Quiet'}
        </Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={THEME.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Main Interactive Screen Area with Dynamic Keyboard Height Padding */}
      <View
        style={[
          styles.contentWrapper,
          {
            paddingBottom: isKeyboardOpen ? keyboardHeight : 0,
          },
        ]}
      >
        {/* Transcript Scroll Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {transcripts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="mic-outline" size={42} color={THEME.colors.conversationAccent} />
              </View>
              <Text style={styles.emptyTitle}>Listening for Speech</Text>
              <Text style={styles.emptySubtitle}>
                Speak in Urdu, English, or mixed conversation. Live captions will appear automatically.
              </Text>
              <Text style={styles.emptyUrduHint}>
                اردو اور انگلش میں بولیں۔ یہاں خودکار طور پر متن نظر آئے گا۔
              </Text>
            </View>
          ) : (
            transcripts.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageCard,
                  item.sender === 'user' ? styles.userMessageCard : styles.partnerMessageCard,
                ]}
              >
                <View style={styles.messageHeader}>
                  <Text style={styles.senderLabel}>
                    {item.sender === 'user' ? 'You' : 'Speaker'}
                  </Text>
                  <Text style={styles.timestampLabel}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.messageText,
                    item.isUrdu && styles.urduText,
                    item.sender === 'user' && styles.userMessageText,
                  ]}
                >
                  {item.text}
                </Text>

                {/* Message Actions: Show Large & Re-speak in Current Selected Voice */}
                <View style={styles.messageActionsRow}>
                  <Pressable
                    style={styles.messageActionBtn}
                    onPress={() => handleOpenCounterDisplay(item.text)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Show large 40px counter display"
                  >
                    <Ionicons name="expand-outline" size={16} color={THEME.colors.textSecondary} />
                    <Text style={styles.messageActionText}>Show Large</Text>
                  </Pressable>

                  <Pressable
                    style={styles.messageActionBtn}
                    onPress={() => handleSpeakAloud(item.text, false)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Speak message aloud in current selected voice"
                  >
                    <Ionicons name="volume-high-outline" size={16} color={THEME.colors.conversationAccent} />
                    <Text style={[styles.messageActionText, { color: THEME.colors.conversationAccent }]}>
                      Speak
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Quick-Reply Ribbon Tray (Collapsed when keyboard is open to maximize typing space) */}
        {!isKeyboardOpen && (
          <View style={styles.quickReplyContainer}>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickReplyScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Save Phrase Trigger Chip */}
              <Pressable
                style={styles.addPhraseChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSavePhraseModalVisible(true);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add custom phrase"
              >
                <Ionicons name="add" size={18} color={THEME.colors.conversationAccent} />
                <Text style={styles.addPhraseText}>Save Phrase</Text>
              </Pressable>

              {/* Quick-Reply Chips */}
              {allQuickReplies.map((reply) => (
                <Pressable
                  key={reply.id}
                  style={[
                    styles.replyChip,
                    reply.isCustom && styles.customReplyChip,
                  ]}
                  onPress={() => handleQuickReplyPress(reply)}
                  onLongPress={() => handleQuickReplyLongPress(reply)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick reply: ${reply.spokenText}`}
                  accessibilityHint={reply.isCustom ? 'Long press to delete' : 'Tap to speak aloud in current voice'}
                >
                  <Text style={styles.replyChipUrdu} numberOfLines={1}>
                    {reply.labelUr}
                  </Text>
                  {reply.labelEn !== reply.labelUr && (
                    <Text style={styles.replyChipEn} numberOfLines={1}>
                      {reply.labelEn}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Typed Input Bar: Always Sits Directly Above Keyboard */}
        <View style={[styles.inputBar, isKeyboardOpen && styles.inputBarFocused]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a reply to speak... / جواب لکھیں"
            placeholderTextColor="#64748B"
            returnKeyType="send"
            onSubmitEditing={handleSendTypedReply}
            blurOnSubmit={false}
            accessible={true}
            accessibilityLabel="Type custom reply text"
          />

          {/* Show Large Action on Current Typed Text */}
          {inputText.trim().length > 0 && (
            <Pressable
              style={styles.inputActionBtn}
              onPress={() => handleOpenCounterDisplay(inputText)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Show typed reply in large 40px display"
            >
              <Ionicons name="expand-outline" size={20} color={THEME.colors.conversationAccent} />
            </Pressable>
          )}

          {/* Speak Button: Instant Zero-Delay Vocalization */}
          <Pressable
            style={({ pressed }) => [
              styles.speakSendPressable,
              pressed && inputText.trim() && styles.buttonPressed,
            ]}
            onPress={handleSendTypedReply}
            disabled={!inputText.trim()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Speak typed text aloud in current voice"
          >
            <LinearGradient
              colors={
                inputText.trim()
                  ? ['#38BDF8', '#0284C7']
                  : ['#1E293B', '#1E293B']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.speakSendButton,
                inputText.trim()
                  ? styles.conversationButtonGradient
                  : styles.speakSendButtonDisabled,
              ]}
            >
              <Ionicons
                name="volume-high"
                size={20}
                color={inputText.trim() ? '#001E2C' : '#64748B'}
              />
              <Text
                style={[
                  styles.speakSendText,
                  !inputText.trim() && styles.speakSendTextDisabled,
                ]}
              >
                Speak
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Bottom Utility Controls Bar (Collapsed when typing so input has full screen visibility) */}
        {!isKeyboardOpen && (
          <View style={styles.bottomBar}>
            <Pressable
              style={({ pressed }) => [
                styles.controlButtonPressable,
                pressed && styles.buttonPressed,
              ]}
              onPress={toggleRecording}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? 'Pause Live Transcription' : 'Resume Live Transcription'}
            >
              <LinearGradient
                colors={
                  isRecording
                    ? ['#EF4444', '#DC2626']
                    : ['#38BDF8', '#0284C7']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.controlButton,
                  isRecording ? styles.pauseActionGradient : styles.conversationActionGradient,
                ]}
              >
                <Ionicons
                  name={isRecording ? 'pause' : 'mic'}
                  size={20}
                  color={isRecording ? '#FFFFFF' : '#001E2C'}
                />
                <Text
                  style={[
                    styles.controlButtonText,
                    isRecording ? styles.pauseButtonText : styles.resumeButtonText,
                  ]}
                >
                  {isRecording ? 'Pause Listening' : 'Resume Listening'}
                </Text>
              </LinearGradient>
            </Pressable>

            {transcripts.length > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleClear}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Clear transcription history"
              >
                <Ionicons name="trash-outline" size={20} color={THEME.colors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Modals */}
      <CounterDisplayModal
        visible={counterModalVisible}
        text={counterModalText}
        onClose={() => setCounterModalVisible(false)}
        onSpeakAgain={(text) => handleSpeakAloud(text, false)}
      />

      <VoiceSelectorModal
        visible={voiceModalVisible}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={handleSelectVoice}
        onClose={() => setVoiceModalVisible(false)}
        onPreviewStart={pauseForTts}
        onPreviewEnd={resumeAfterTts}
      />

      <SavePhraseModal
        visible={savePhraseModalVisible}
        onSave={handleSaveCustomPhrase}
        onClose={() => setSavePhraseModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: THEME.spacing.sm,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  voiceSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    flexShrink: 0,
  },
  voiceSelectorText: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  meterContainer: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meterTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  meterLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'right',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.badge,
    gap: THEME.spacing.xs,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: THEME.typography.sizes.caption,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: THEME.spacing.md,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: THEME.spacing.lg,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  emptyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineMd,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.bodyMd,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  emptyUrduHint: {
    color: THEME.colors.conversationAccent,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 30,
    fontFamily: 'System',
  },
  messageCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    maxWidth: '92%',
  },
  partnerMessageCard: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  userMessageCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284C7',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timestampLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  messageText: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  urduText: {
    fontSize: 22,
    lineHeight: 36,
    textAlign: 'right',
  },
  messageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  messageActionText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  quickReplyContainer: {
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
  },
  quickReplyScrollContent: {
    paddingHorizontal: THEME.spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  addPhraseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1.5,
    borderColor: THEME.colors.conversationAccent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  addPhraseText: {
    color: THEME.colors.conversationAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  replyChip: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  customReplyChip: {
    borderColor: 'rgba(56, 189, 248, 0.3)',
    backgroundColor: '#0F1E36',
  },
  replyChipUrdu: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  replyChipEn: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090D16',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  inputBarFocused: {
    backgroundColor: '#090D16',
  },
  textInput: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#131B2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inputActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  speakSendPressable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  speakSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  conversationButtonGradient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  speakSendButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  speakSendText: {
    color: '#001E2C',
    fontSize: 14,
    fontWeight: '700',
  },
  speakSendTextDisabled: {
    color: '#64748B',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: '#090D16',
    gap: THEME.spacing.sm,
  },
  controlButtonPressable: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  controlButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  conversationActionGradient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pauseActionGradient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  controlButtonText: {
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  resumeButtonText: {
    color: '#001E2C',
  },
  pauseButtonText: {
    color: '#FFFFFF',
  },
  clearButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});
