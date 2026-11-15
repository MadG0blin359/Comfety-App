import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { THEME } from '../src/constants/theme';
import { STORAGE_KEYS } from '../src/constants/config';
import { checkPermissionsSnapshot, requestMicrophonePermission, requestCameraPermission } from '../src/utils/permissions';
import { useShakeGesture } from '../src/hooks/useShakeGesture';
import { AppMode, PermissionsSnapshot } from '../src/types';
import { Ionicons } from '@expo/vector-icons';

// Crisp, GPU-rendered vector chevron that never glitches or renders as ''n'
function ChevronRight({ color = '#001E2C', size = 9 }: { color?: string; size?: number }) {
  return (
    <View style={styles.chevronCircle}>
      <View
        style={[
          styles.chevronStem,
          {
            width: size,
            height: size,
            borderColor: color,
          },
        ]}
      />
    </View>
  );
}

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
  // 180ms pulse, 280ms pause, 180ms pulse ensures two unmistakable tactile beats
  useEffect(() => {
    try {
      Vibration.vibrate([0, 180, 280, 180]);
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
      if (!permissions.microphone.granted) {
        await requestMicrophonePermission();
      }
      router.push('/conversation');
    } else {
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

          // Otherwise, speak immediate welcome audio
          Speech.stop();
          Speech.speak(
            'Welcome to Comfety. Tap the top half for Conversation Mode. Tap the bottom half, hold anywhere for two seconds, or shake the phone to start Guide Mode.',
            {
              language: 'en-US',
              rate: 0.95,
              pitch: 1.0,
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
    <LinearGradient
      colors={['#0F1626', '#090D16', '#05080E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.rootGradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Minimal Ambient Header */}
          <View style={styles.header}>
            <Text style={styles.appTitle} numberOfLines={1} ellipsizeMode="tail">Comfety</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">Assistive Communication & Navigation</Text>
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
            {/* Dark Linear Gradient Background */}
            <LinearGradient
              colors={['#102235', '#0C1826', '#090F17']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Ambient Cyan Glow Arc at top-right */}
            <LinearGradient
              colors={['rgba(56, 189, 248, 0.28)', 'rgba(56, 189, 248, 0.05)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.ambientGlowArc}
            />

            {/* Top Row: Icon Container & Hardware Badge */}
            <View style={styles.cardTopRow}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.iconBox, styles.conversationIconBox]}
              >
                <Ionicons name="chatbubbles-outline" size={24} color="#38BDF8" />
              </LinearGradient>

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

            {/* Bottom Action Affordance Button with Horizontal Gradient */}
            <LinearGradient
              colors={['#38BDF8', '#0284C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionButton, styles.conversationActionGradient]}
            >
              <Text style={styles.conversationActionText}>Open Conversation</Text>
              <ChevronRight color="#001E2C" />
            </LinearGradient>
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
            {/* Dark Linear Gradient Background */}
            <LinearGradient
              colors={['#0C251C', '#081A12', '#050F0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Ambient Emerald Glow Arc at top-right */}
            <LinearGradient
              colors={['rgba(52, 211, 153, 0.28)', 'rgba(52, 211, 153, 0.05)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.ambientGlowArc}
            />

            {/* Top Row: Icon Container & Hardware Badge */}
            <View style={styles.cardTopRow}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.iconBox, styles.guideIconBox]}
              >
                <Ionicons name="eye-outline" size={24} color="#34D399" />
              </LinearGradient>

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

            {/* Bottom Action Affordance Button with Horizontal Gradient */}
            <LinearGradient
              colors={['#34D399', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionButton, styles.guideActionGradient]}
            >
              <Text style={styles.guideActionText}>Start Guide Mode</Text>
              <ChevronRight color="#002114" />
            </LinearGradient>
          </Pressable>

          {/* Ambient Sensory Footer Banner with Gradient */}
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerBanner}
          >
            <View style={styles.footerIconContainer}>
              <Ionicons name="volume-high-outline" size={22} color="#38BDF8" />
            </View>
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerTitle}>Auto-Voice & No-Look Entry</Text>
              <Text style={styles.footerSubtitle}>
                Speaks automatically • Hold anywhere (2s) or shake to start Guide
              </Text>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  rootGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
  appTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.headlineLg,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.bodyMd,
    marginTop: 2,
  },
  modeCard: {
    flex: 1,
    borderRadius: 22,
    padding: THEME.spacing.md,
    justifyContent: 'space-between',
    marginVertical: THEME.spacing.xs,
    minHeight: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  conversationCard: {
    borderWidth: 2,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  guideCard: {
    borderWidth: 2,
    borderColor: '#34D399',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ambientGlowArc: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: THEME.borderRadius.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationIconBox: {
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  guideIconBox: {
    borderWidth: 1.5,
    borderColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.badge,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    zIndex: 2,
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
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  conversationActionGradient: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  guideActionGradient: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  conversationActionText: {
    color: '#001E2C',
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  guideActionText: {
    color: '#002114',
    fontSize: THEME.typography.sizes.bodyLg,
    fontWeight: '700',
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronStem: {
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: -2,
  },
  footerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  footerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerTextContainer: {
    flex: 1,
    marginLeft: THEME.spacing.sm,
  },
  footerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.bodyMd,
    fontWeight: '600',
  },
  footerSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.caption,
    marginTop: 2,
  },
});
