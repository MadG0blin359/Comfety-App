import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import {
  Camera,
  usePhotoOutput,
  useCameraPermission,
} from 'react-native-vision-camera';
import { THEME } from '../src/constants/theme';
import { speakText, stopSpeech } from '../src/services/ttsManager';
import {
  describeSceneOrReadText,
  simplifyLastResponse,
  resetVisionConversation,
} from '../src/services/geminiVision';

/**
 * Converts a Uint8Array into a base64 string safely without exceeding call stack limits.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export default function GuideScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isRadarActive, setIsRadarActive] = useState<boolean>(true);
  const [torchMode, setTorchMode] = useState<'off' | 'on'>('off');
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Tap anywhere to scan');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastSpokenText, setLastSpokenText] = useState<string>('');

  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Vision Camera v5 Photo Output configuration
  const photoOutput = usePhotoOutput({
    qualityPrioritization: 'speed',
  });

  // Handle Android system back press
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopSpeech();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.replace('/?select=true');
  }, [router]);

  useEffect(() => {
    const onHardwareBack = () => {
      handleBack();
      return true;
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSub.remove();
  }, [handleBack]);

  // Request camera permission on mount if needed
  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch((err) =>
        console.warn('[GuideMode] Camera permission request error:', err)
      );
    }
  }, [hasPermission, requestPermission]);

  // Spoken onboarding announcement upon entering Guide Mode
  useEffect(() => {
    resetVisionConversation();
    setIsCameraActive(true);

    const welcomeTimeout = setTimeout(() => {
      speakText(
        'Guide Mode active. Tap once to describe or ask. Double tap to simplify. Hold to toggle alerts.',
        {
          onStart: () => setStatusMessage('Guide Mode Active'),
        }
      );
    }, 400);

    return () => {
      clearTimeout(welcomeTimeout);
      stopSpeech();
      setIsCameraActive(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Captures high-res photo from Camera, reads base64 in-memory, and requests Gemini analysis.
   */
  const captureAndAnalyze = useCallback(
    async (spokenQuestion?: string) => {
      if (isProcessing) return;

      setIsProcessing(true);
      setStatusMessage('Capturing & analyzing scene...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Create cancellation signal for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Capture photo via Vision Camera v5 Photo Output
        const photo = await photoOutput.capturePhoto({}, {});
        const arrayBuffer = await photo.getFileDataAsync();
        const bytes = new Uint8Array(arrayBuffer);
        const base64Jpeg = uint8ArrayToBase64(bytes);

        // Immediately dispose native image memory to prevent native memory exhaustion
        photo.dispose();

        setStatusMessage('AI Analyzing...');

        const result = await describeSceneOrReadText(base64Jpeg, {
          signal: controller.signal,
          userSpokenQuestion: spokenQuestion,
        });

        setLastSpokenText(result.text);
        setStatusMessage(result.hasTextReading ? 'Text Detected' : 'Scene Described');

        // Announce aloud through natural TTS
        speakText(result.text, {
          onDone: () => {
            setStatusMessage('Ready • Tap anywhere to scan');
          },
        });
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          setStatusMessage('Analysis cancelled');
          return;
        }
        console.error('[GuideMode] Capture/Analysis error:', err);
        const errorMsg = 'Could not analyze scene. Please tap to try again.';
        setStatusMessage('Analysis failed');
        speakText(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, photoOutput]
  );

  /**
   * Double-tap action: Restates previous visual response in plain, simple everyday words.
   */
  const handleSimplification = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setStatusMessage('Simplifying explanation...');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopSpeech();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await simplifyLastResponse({ signal: controller.signal });
      setLastSpokenText(result.text);
      setStatusMessage('Simplified Explanation');

      speakText(result.text, {
        onDone: () => {
          setStatusMessage('Ready • Tap anywhere to scan');
        },
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      console.error('[GuideMode] Simplification error:', err);
      speakText('Unable to simplify at this moment. Tap once to scan again.');
      setStatusMessage('Simplification failed');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  /**
   * Single-tap handler with smart 2.5s fallback:
   * Tapping emits immediate haptic feedback, stops active speech, and triggers capture.
   */
  const handleSingleTap = useCallback(() => {
    stopSpeech();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatusMessage('Scanning in front of you...');
    captureAndAnalyze();
  }, [captureAndAnalyze]);

  /**
   * Master touch dispatcher handling 1x Tap vs 2x Tap resolution across the entire screen.
   */
  const handleTouchPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 320;

    if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      // Double Tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;
      handleSimplification();
    } else {
      // First tap: delay slightly to wait for possible second tap
      lastTapTimeRef.current = now;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        handleSingleTap();
      }, DOUBLE_TAP_DELAY);
    }
  }, [handleSingleTap, handleSimplification]);

  /**
   * 1.5s Long Press handler: Toggles obstacle alerts/radar with spoken & haptic confirmation.
   */
  const handleLongPress = useCallback(() => {
    // Clear any pending single-tap timer
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastTapTimeRef.current = 0;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRadarActive((prev) => {
      const nextState = !prev;
      speakText(nextState ? 'Obstacle alerts active' : 'Obstacle alerts paused');
      return nextState;
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Clean Header: Back Button, Title, and Scanning Badge (Zero Small Controls) */}
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Guide Mode
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Vision AI Active
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isRadarActive
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              borderColor: isRadarActive
                ? 'rgba(52, 211, 153, 0.3)'
                : 'rgba(239, 68, 68, 0.3)',
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isRadarActive
                  ? THEME.colors.guideAccent
                  : THEME.colors.danger,
              },
            ]}
          />
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isRadarActive
                  ? THEME.colors.guideAccent
                  : THEME.colors.danger,
              },
            ]}
            numberOfLines={1}
          >
            {isRadarActive ? 'Radar ON' : 'Radar OFF'}
          </Text>
        </View>
      </View>

      {/* Main Full-Screen Viewfinder & Universal Touch Surface */}
      <Pressable
        style={styles.viewfinderContainer}
        onPress={handleTouchPress}
        onLongPress={handleLongPress}
        delayLongPress={1500}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Guide Mode Camera Surface. Tap once to scan or ask. Double tap to simplify. Hold to toggle alerts."
      >
        {hasPermission ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device="back"
            isActive={isCameraActive}
            outputs={[photoOutput]}
            torchMode={torchMode}
          />
        ) : (
          <View style={styles.permissionFallback}>
            <Ionicons name="camera-outline" size={48} color={THEME.colors.warning} />
            <Text style={styles.permissionText}>Camera Permission Required</Text>
            <Pressable
              style={styles.permissionButton}
              onPress={() => requestPermission()}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </Pressable>
          </View>
        )}

        {/* Ambient Spatial Scanning Matrix (Subtle Glass Overlay) */}
        <View style={styles.reticleOverlay} pointerEvents="none">
          <View style={styles.reticleBox}>
            <View style={[styles.reticleCorner, styles.topLeft]} />
            <View style={[styles.reticleCorner, styles.topRight]} />
            <View style={[styles.reticleCorner, styles.bottomLeft]} />
            <View style={[styles.reticleCorner, styles.bottomRight]} />
          </View>
        </View>

        {/* Status Pill & Activity Spinner */}
        <View style={styles.statusPillContainer} pointerEvents="none">
          <View style={styles.statusPill}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={THEME.colors.conversationAccent} />
            ) : (
              <Ionicons
                name="scan-outline"
                size={16}
                color={THEME.colors.guideAccent}
              />
            )}
            <Text style={styles.statusPillText} numberOfLines={1}>
              {statusMessage}
            </Text>
          </View>
        </View>

        {/* Gesture Guidance Footer (Zero-Vision Tactile Cue) */}
        <View style={styles.gestureHintBar} pointerEvents="none">
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText}>1x Tap: Scan</Text>
          </View>
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText}>2x Tap: Simplify</Text>
          </View>
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText}>Hold: Radar</Text>
          </View>
        </View>
      </Pressable>
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
    backgroundColor: '#090D16',
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  permissionFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  permissionText: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: THEME.colors.conversationAccent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#001E2C',
    fontSize: 14,
    fontWeight: '700',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  reticleCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(52, 211, 153, 0.85)',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  statusPillContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: '92%',
  },
  statusPillText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  gestureHintBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  gestureHintPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gestureHintText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
