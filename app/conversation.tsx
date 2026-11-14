import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { THEME } from '../src/constants/theme';

export default function ConversationScreen() {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to mode selection screen"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Conversation Mode</Text>
          <Text style={styles.headerSubtitle}>Live Speech Relay</Text>
        </View>

        <View style={styles.voiceBadge}>
          <Text style={styles.voiceBadgeText}>Ayesha</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.placeholderCard}>
          <View style={styles.listeningBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.listeningText}>Bilingual AI Ready</Text>
          </View>
          <Text style={styles.placeholderTitle}>Part A: Speech Relay Shell</Text>
          <Text style={styles.placeholderDesc}>
            Bilingual Whisper STT and Multi-Voice TTS will be activated here in Phase 2 & 3.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  backButton: {
    minWidth: THEME.touchTargets.min,
    minHeight: THEME.touchTargets.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: THEME.colors.surfaceInteractive,
  },
  backButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
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
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  voiceBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: THEME.colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: THEME.colors.conversationBorder,
  },
  voiceBadgeText: {
    color: THEME.colors.conversationAccent,
    fontSize: THEME.typography.sizes.caption,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: THEME.spacing.md,
    justifyContent: 'center',
  },
  placeholderCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.card,
    padding: THEME.spacing.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.conversationBorder,
    alignItems: 'center',
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceInteractive,
    marginBottom: THEME.spacing.md,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.conversationAccent,
    marginRight: 8,
  },
  listeningText: {
    color: THEME.colors.conversationAccent,
    fontSize: THEME.typography.sizes.caption,
    fontWeight: '600',
  },
  placeholderTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineMd,
    fontWeight: '700',
    marginBottom: THEME.spacing.sm,
    textAlign: 'center',
  },
  placeholderDesc: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.bodyMd,
    textAlign: 'center',
    lineHeight: THEME.typography.lineHeights.bodyMd,
  },
});
