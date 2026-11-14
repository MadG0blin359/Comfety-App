import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { THEME } from '../src/constants/theme';
import { STORAGE_KEYS } from '../src/constants/config';
import { checkPermissionsSnapshot, requestMicrophonePermission, requestCameraPermission } from '../src/utils/permissions';
import { useShakeGesture } from '../src/hooks/useShakeGesture';
import { AppMode, PermissionsSnapshot } from '../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ select?: string }>();
  const isNavigatingRef = useRef<boolean>(false);
  const [isScreenFocused, setIsScreenFocused] = useState<boolean>(true);

  const [permissions, setPermissions] = useState<PermissionsSnapshot>({
    microphone: { granted: false, canAskAgain: true, status: 'undetermined' },
    camera: { granted: false, canAskAgain: true, status: 'undetermined' },
  });

  // Startup Sensory Safeguard: Distinct dual-pulse tactile wake-up burst on mount
  // Guarantees blind users physically feel Comfety wake up even if media volume is at 0%
  useEffect(() => {
    try {
      Vibration.vibrate([0, 150, 80, 200]);
    } catch (err) {
      console.warn('[Home] Startup vibration failed:', err);
    }
  }, []);

  // Query permissions state on mount and focus
  const refreshPermissions = useCallback(async () => {
    try {
      const snapshot = await checkPermissionsSnapshot();
      setPermissions(snapshot);
    } catch (error) {
      console.error('[Home] Failed to load permissions:', error);
    }
  }, []);

  // Safe navigation that halts active speech and emits tactile feedback
  const navigateToMode = useCallback(async (mode: AppMode) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    // Immediately stop any active onboarding announcement
    Speech.stop();

    // Tactile confirmation
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Save preferred mode memory
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_MODE, mode);
    } catch (err) {
      console.error('[Home] Failed to persist preferred mode:', err);
    }

    if (mode === 'conversation') {
      // Pre-check microphone
      if (!permissions.microphone.granted) {
        await requestMicrophonePermission();
      }
      router.push('/conversation');
    } else {
      // Pre-check camera
      if (!permissions.camera.granted) {
        await requestCameraPermission();
      }
      router.push('/guide');
    }

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 500);
  }, [permissions, router]);

  // Screen focus lifecycle: handle speech onboarding & shake listener
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      isNavigatingRef.current = false;
      refreshPermissions();

      const runOnboardingAndAutoOpen = async () => {
        try {
          const autoOpen = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_OPEN);
          const preferredMode = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_MODE) as AppMode | null;

          // If autoOpen is set and not bypassed by ?select=true, route immediately
          if (autoOpen === 'true' && preferredMode && params.select !== 'true') {
            navigateToMode(preferredMode);
            return;
          }

          // Spoken Onboarding Announcement (Section 5.A.2)
          Speech.stop();
          Speech.speak(
            'Welcome to Comfety. Tap the top half for Conversation Mode. Tap the bottom half, hold anywhere for two seconds, or shake the phone to start Guide Mode.',
            {
              language: 'en',
              rate: 0.95,
            }
          );
        } catch (error) {
          console.error('[Home] Auto-open check failed:', error);
        }
      };

      runOnboardingAndAutoOpen();

      return () => {
        setIsScreenFocused(false);
        Speech.stop();
      };
    }, [params.select, navigateToMode, refreshPermissions])
  );

  // No-Look Blind Entry 1: Double Shake (> 2.1g within 1000ms) launches Guide Mode
  useShakeGesture({
    enabled: isScreenFocused,
    onShake: () => {
      navigateToMode('guide');
    },
  });

  // Universal Long Press (2000ms anywhere on screen) launches Guide Mode (Section 5.A.4)
  const handleUniversalLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigateToMode('guide');
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Minimal Ambient Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.appTitle}>Comfety</Text>
            <View style={styles.readyBadge}>
              <View style={styles.readyDot} />
              <Text style={styles.readyBadgeText}>Ready</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>Assistive Communication & Navigation</Text>
        </View>

        {/* 50/50 Viewport Split: Card 1 (Conversation Mode) */}
        <Pressable
          style={({ pressed }) => [
            styles.modeCard,
            styles.conversationCard,
            pressed && styles.cardPressed,
          ]}
          onPressIn={handlePressIn}
          onPress={() => navigateToMode('conversation')}
          delayLongPress={2000}
          onLongPress={handleUniversalLongPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Conversation Mode. Live Urdu and English captions plus natural voice replies."
          accessibilityHint="Double tap to open Conversation Mode, or hold for two seconds to start Guide Mode."
        >
          {/* Top Row: Icon Container & Hardware Badge */}
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBox, styles.conversationIconBox]}>
              <Text style={styles.iconGlyph}>👂</Text>
            </View>

            <View style={styles.hardwareBadge}>
              <Text style={[
                styles.hardwareBadgeText,
                { color: permissions.microphone.granted ? THEME.colors.conversationAccent : THEME.colors.warning }
              ]}>
                {permissions.microphone.granted ? 'Bilingual AI • Mic Ready' : 'Mic Required'}
              </Text>
            </View>
          </View>

          {/* Center Content: Title & Description */}
          <View style={styles.cardCenterContent}>
            <Text style={styles.cardTitle}>Conversation Mode</Text>
            <Text style={styles.cardSubtitle}>
              Live Urdu & English captions + natural voice replies
            </Text>
          </View>

          {/* Bottom Action Affordance Button */}
          <View style={[styles.actionButton, styles.conversationActionButton]}>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonIcon}>🎙️</Text>
              <Text style={styles.conversationActionText}>Open Conversation</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </View>
        </Pressable>

        {/* 50/50 Viewport Split: Card 2 (Guide Mode) */}
        <Pressable
          style={({ pressed }) => [
            styles.modeCard,
            styles.guideCard,
            pressed && styles.cardPressed,
          ]}
          onPressIn={handlePressIn}
          onPress={() => navigateToMode('guide')}
          delayLongPress={2000}
          onLongPress={handleUniversalLongPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Guide Mode. Camera obstacle alerts, label reader, and voice assistant."
          accessibilityHint="Double tap to open Guide Mode, or hold for two seconds to start Guide Mode."
        >
          {/* Top Row: Icon Container & Hardware Badge */}
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBox, styles.guideIconBox]}>
              <Text style={styles.iconGlyph}>👁️</Text>
            </View>

            <View style={styles.hardwareBadge}>
              <View style={[
                styles.pulseIndicatorDot,
                { backgroundColor: permissions.camera.granted ? THEME.colors.guideAccent : THEME.colors.warning }
              ]} />
              <Text style={[
                styles.hardwareBadgeText,
                { color: permissions.camera.granted ? THEME.colors.guideAccent : THEME.colors.warning }
              ]}>
                {permissions.camera.granted ? 'Vision AI Ready' : 'Camera Required'}
              </Text>
            </View>
          </View>

          {/* Center Content: Title & Description */}
          <View style={styles.cardCenterContent}>
            <Text style={styles.cardTitle}>Guide Mode</Text>
            <Text style={styles.cardSubtitle}>
              Camera obstacle alerts, label reader & voice assistant
            </Text>
          </View>

          {/* Bottom Action Affordance Button */}
          <View style={[styles.actionButton, styles.guideActionButton]}>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonIcon}>📡</Text>
              <Text style={styles.guideActionText}>Start Guide Mode</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </View>
        </Pressable>

        {/* Ambient Sensory Footer Banner */}
        <View style={styles.footerBanner}>
          <View style={styles.footerIconContainer}>
            <Text style={styles.footerIconGlyph}>🔊</Text>
          </View>
          <View style={styles.footerTextContainer}>
            <Text style={styles.footerTitle}>Auto-Voice & No-Look Entry</Text>
            <Text style={styles.footerSubtitle}>
              Speaks automatically • Hold anywhere (2s) or shake to start Guide
            </Text>
          </View>
          <Text style={styles.footerCheckGlyph}>✓</Text>
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
  container: {
    flex: 1,
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: THEME.spacing.xs,
    paddingBottom: THEME.spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  appTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineLg,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.safe,
    marginRight: 6,
  },
  readyBadgeText: {
    color: THEME.colors.safe,
    fontSize: THEME.typography.sizes.caption,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.bodyMd,
    marginTop: 2,
  },
  modeCard: {
    flex: 1,
    borderRadius: THEME.borderRadius.card,
    backgroundColor: THEME.colors.surfaceElevated,
    padding: THEME.spacing.md,
    justifyContent: 'space-between',
    marginVertical: THEME.spacing.xs,
    minHeight: 200,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  conversationCard: {
    borderWidth: 2,
    borderColor: THEME.colors.conversationBorder,
  },
  guideCard: {
    borderWidth: 2,
    borderColor: THEME.colors.guideBorder,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: THEME.borderRadius.iconBox,
    backgroundColor: THEME.colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationIconBox: {
    borderWidth: 1.5,
    borderColor: THEME.colors.conversationBorder,
  },
  guideIconBox: {
    borderWidth: 1.5,
    borderColor: THEME.colors.guideBorder,
  },
  iconGlyph: {
    fontSize: 26,
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: THEME.colors.surfaceInteractive,
  },
  pulseIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  hardwareBadgeText: {
    fontSize: THEME.typography.sizes.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardCenterContent: {
    marginVertical: THEME.spacing.xs,
  },
  cardTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineMd,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.bodyMd,
    lineHeight: THEME.typography.lineHeights.bodyMd,
    marginTop: 4,
  },
  actionButton: {
    width: '100%',
    height: THEME.touchTargets.actionButton,
    borderRadius: THEME.borderRadius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
  },
  conversationActionButton: {
    backgroundColor: THEME.colors.conversationContainer,
  },
  guideActionButton: {
    backgroundColor: THEME.colors.guideContainer,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  conversationActionText: {
    color: THEME.colors.onConversationContainer,
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  guideActionText: {
    color: THEME.colors.onGuideContainer,
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  actionArrow: {
    color: THEME.colors.onConversationContainer,
    fontSize: 22,
    fontWeight: '700',
  },
  footerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceInteractive,
    borderRadius: THEME.borderRadius.card,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginTop: THEME.spacing.xs,
  },
  footerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  footerIconGlyph: {
    fontSize: 18,
  },
  footerTextContainer: {
    flex: 1,
    marginRight: THEME.spacing.xs,
  },
  footerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.caption + 1,
    fontWeight: '700',
  },
  footerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.caption - 1,
    lineHeight: 16,
    marginTop: 2,
  },
  footerCheckGlyph: {
    color: THEME.colors.safe,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
});
