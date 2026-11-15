import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../src/constants/theme';

export default function GuideScreen() {
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
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Guide Mode
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            Vision AI Active
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusBadgeText} numberOfLines={1}>
            Radar ON
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.placeholderCard}>
          <View style={styles.visionBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.visionText}>Vision AI Ready</Text>
          </View>
          <Text style={styles.placeholderTitle}>Part B: Guide Assistant Shell</Text>
          <Text style={styles.placeholderDesc}>
            Real-time Camera, TFLite obstacle detection, and Gemini 3.8 Flash OCR will be integrated here in Phase 4 & 5.
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
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: THEME.spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.guideAccent,
    marginRight: 6,
  },
  statusBadgeText: {
    color: THEME.colors.guideAccent,
    fontSize: 11,
    fontWeight: '600',
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
    borderColor: THEME.colors.guideBorder,
    alignItems: 'center',
  },
  visionBadge: {
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
    backgroundColor: THEME.colors.guideAccent,
    marginRight: 8,
  },
  visionText: {
    color: THEME.colors.guideAccent,
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
