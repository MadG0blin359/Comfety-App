import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../src/constants/theme';
import { useAudioChunker } from '../src/hooks/useAudioChunker';

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
    clearTranscripts,
  } = useAudioChunker({ enabled: true });

  // Auto-scroll to bottom when new transcript items arrive
  useEffect(() => {
    if (transcripts.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcripts]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopRecording();
    router.back();
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
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
          <Text style={styles.headerTitle}>Conversation Mode</Text>
          <Text style={styles.headerSubtitle}>Live Bilingual Speech</Text>
        </View>

        {/* Live Status Pill */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isTranscribing
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
                backgroundColor: isTranscribing
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
                color: isTranscribing
                  ? THEME.colors.conversationAccent
                  : isRecording
                  ? THEME.colors.safe
                  : THEME.colors.danger,
              },
            ]}
          >
            {isTranscribing ? 'Transcribing...' : isRecording ? 'Listening' : 'Paused'}
          </Text>
        </View>
      </View>

      {/* Real-time RMS Decibel Meter Bar (Visual sound feedback for Deaf accessibility) */}
      <View style={styles.meterContainer}>
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.round(meterLevel * 100)}%`,
                backgroundColor:
                  meterLevel > 0.4 ? THEME.colors.conversationAccent : 'rgba(56, 189, 248, 0.5)',
              },
            ]}
          />
        </View>
        <Text style={styles.meterLabel}>
          {meterLevel > 0.15 ? `Voice Detected (${Math.round(currentDb)} dB)` : 'Mic Level'}
        </Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={THEME.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Transcript Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={true}
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
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Controls Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[
            styles.controlButton,
            isRecording ? styles.pauseButton : styles.resumeButton,
          ]}
          onPress={toggleRecording}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Pause Live Transcription' : 'Resume Live Transcription'}
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
        </Pressable>

        {transcripts.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={handleClear}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear transcription history"
          >
            <Ionicons name="trash-outline" size={20} color={THEME.colors.textSecondary} />
          </Pressable>
        )}
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: THEME.touchTargets.min,
    height: THEME.touchTargets.min,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineMd,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.caption,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meterContainer: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
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
    minWidth: 80,
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
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: THEME.spacing.md,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    fontSize: 20, // Min 20px high contrast as required by Section 5.B
    lineHeight: 28,
    fontWeight: '500',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  urduText: {
    fontSize: 22,
    lineHeight: 36, // lineHeight >= fontSize * 1.6 required for Nastaliq
    textAlign: 'right',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: THEME.spacing.sm,
  },
  controlButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
  },
  resumeButton: {
    backgroundColor: THEME.colors.conversationAccent,
  },
  pauseButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
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
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
