import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  useCameraDevice,
  usePhotoOutput,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { THEME } from '../src/constants/theme';
import { speakText, stopSpeech } from '../src/services/ttsManager';
import {
  describeSceneOrReadText,
  simplifyLastResponse,
  resetVisionConversation,
} from '../src/services/geminiVision';
import { transcribeAudio, isWhisperHallucination } from '../src/services/groqStt';
import { AUDIO_METERING_CONFIG } from '../src/constants/config';

/**
 * Pure bitwise Base64 encoder operating directly on Uint8Array.
 * Zero external dependencies, zero reliance on global btoa, and zero call-stack overflow risk.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  const rem = len % 3;
  const mainLen = len - rem;

  for (let i = 0; i < mainLen; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    base64 +=
      chars[(chunk >> 18) & 63] +
      chars[(chunk >> 12) & 63] +
      chars[(chunk >> 6) & 63] +
      chars[chunk & 63];
  }

  if (rem === 1) {
    const chunk = bytes[mainLen];
    base64 += chars[(chunk >> 2) & 63] + chars[(chunk << 4) & 63] + '==';
  } else if (rem === 2) {
    const chunk = (bytes[mainLen] << 8) | bytes[mainLen + 1];
    base64 +=
      chars[(chunk >> 10) & 63] +
      chars[(chunk >> 4) & 63] +
      chars[(chunk << 2) & 63] +
      '=';
  }

  return base64;
}

export default function GuideScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isCameraStarted, setIsCameraStarted] = useState<boolean>(false);
  const [isRadarActive, setIsRadarActive] = useState<boolean>(true);
  const [torchMode, setTorchMode] = useState<'off' | 'on' | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Tap to scan');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Microphone audio recorder for smart 2.5s spoken question listening
  const questionRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const questionRecorderState = useAudioRecorderState(questionRecorder, 100);
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDbInQuestionRef = useRef<number>(-100);
  const speechFramesInQuestionRef = useRef<number>(0);
  const isListeningQuestionRef = useRef<boolean>(false);

  // Monitor microphone levels during the 2.5s question window
  useEffect(() => {
    if (!isListeningQuestionRef.current) return;
    if (typeof questionRecorderState.metering === 'number') {
      const db = questionRecorderState.metering;
      maxDbInQuestionRef.current = Math.max(maxDbInQuestionRef.current, db);
      if (db >= AUDIO_METERING_CONFIG.rmsSilenceThresholdDb) {
        speechFramesInQuestionRef.current += 1;
      }
    }
  }, [questionRecorderState.metering]);

  const cancelQuestionListening = useCallback(async () => {
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    isListeningQuestionRef.current = false;
    try {
      if (questionRecorder.isRecording) {
        await questionRecorder.stop();
      }
    } catch (err) {
      console.warn('[GuideMode] Error stopping question recorder:', err);
    }
  }, [questionRecorder]);

  // Vision Camera v5 Photo Output configuration
  const photoOutput = usePhotoOutput({
    qualityPrioritization: 'speed',
  });

  // Handle native Vision Camera session errors gracefully
  const handleCameraError = useCallback((err: Error) => {
    const msg = err.message || String(err);
    // Ignore harmless OperationCanceledException during session initialization or shutdown
    if (
      msg.includes('OperationCanceledException') ||
      msg.includes('Camera is not active')
    ) {
      console.warn('[GuideMode] Non-fatal camera operation cancellation:', msg);
      return;
    }
    console.error('[GuideMode] Camera error:', err);
  }, []);

  // Handle Android system back press
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopSpeech();
    cancelQuestionListening();
    setTorchMode('off');
    setIsCameraActive(false);
    setIsCameraStarted(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.replace('/?select=true');
  }, [cancelQuestionListening, router]);

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
      cancelQuestionListening();
      setTorchMode('off');
      setIsCameraActive(false);
      setIsCameraStarted(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cancelQuestionListening]);

  /**
   * Captures high-res photo from Camera, reads base64 in-memory, and requests Gemini analysis.
   */
  const captureAndAnalyze = useCallback(
    async (spokenQuestion?: string) => {
      if (isProcessing) return;

      setIsProcessing(true);
      setStatusMessage('AI Analyzing...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Blind accessibility: Immediately inform the blind user through audio that AI is analyzing
      speakText('Analyzing...');

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

        setStatusMessage(result.hasTextReading ? 'Text Detected' : 'Scene Described');

        // Discard speech if app was minimized or screen locked while analyzing
        if (AppState.currentState !== 'active') {
          return;
        }

        // Announce aloud through natural TTS
        speakText(result.text, {
          onDone: () => {
            setStatusMessage('Ready • Tap to scan');
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
    cancelQuestionListening();
    if (isProcessing) return;

    setIsProcessing(true);
    setStatusMessage('Simplifying...');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Blind accessibility: Immediately confirm simplification action through speech
    speakText('Simplifying...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await simplifyLastResponse({ signal: controller.signal });
      setStatusMessage('Simplified');

      // Discard speech if app was minimized or screen locked while simplifying
      if (AppState.currentState !== 'active') {
        return;
      }

      speakText(result.text, {
        onDone: () => {
          setStatusMessage('Ready • Tap to scan');
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
  }, [cancelQuestionListening, isProcessing]);

  /**
   * Single-tap handler with smart 2.5s question-vs-scan fallback:
   * Tapping emits immediate haptic feedback, stops active speech, and opens
   * a 2.5-second listening window for spoken questions.
   * If speech is detected, prompt Gemini with the spoken question.
   * If silence is detected for 2.5s, auto-capture and read/describe.
   */
  const handleSingleTap = useCallback(async () => {
    stopSpeech();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isProcessing) return;

    // Check microphone permission for question asking
    let canRecord = false;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      canRecord = granted;
      if (granted) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }
    } catch {
      canRecord = false;
    }

    if (!canRecord) {
      // If mic permission unavailable, proceed directly to scene scan
      setStatusMessage('AI Analyzing...');
      captureAndAnalyze();
      return;
    }

    // Start 2.5s question listening window
    setStatusMessage('Listening • Or wait to scan');
    maxDbInQuestionRef.current = -100;
    speechFramesInQuestionRef.current = 0;
    isListeningQuestionRef.current = true;

    try {
      await questionRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      questionRecorder.record();
    } catch (recErr) {
      console.warn('[GuideMode] Failed to start question recording:', recErr);
      isListeningQuestionRef.current = false;
      captureAndAnalyze();
      return;
    }

    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    questionTimerRef.current = setTimeout(async () => {
      questionTimerRef.current = null;
      if (!isListeningQuestionRef.current) return;
      isListeningQuestionRef.current = false;

      const peakDb = maxDbInQuestionRef.current;
      const speechFrames = speechFramesInQuestionRef.current;

      try {
        if (questionRecorder.isRecording) {
          await questionRecorder.stop();
        }
      } catch (stopErr) {
        console.warn('[GuideMode] Question recorder stop error:', stopErr);
      }

      const chunkUri = questionRecorder.uri;

      // Check if user spoke a question (> -35dB and >= 3 speech frames)
      if (
        chunkUri &&
        peakDb >= AUDIO_METERING_CONFIG.rmsSilenceThresholdDb &&
        speechFrames >= 3
      ) {
        setStatusMessage('Transcribing...');
        try {
          const transResult = await transcribeAudio(chunkUri);
          const userQuestion = transResult.text.trim();

          if (userQuestion.length > 0 && !isWhisperHallucination(userQuestion)) {
            // Check for torch commands
            const wantsTorchOn =
              /turn on light|turn on torch|flash on|light on|torch on|روشنی جلاؤ|ٹارچ چلاؤ|بتی جلاؤ/i.test(
                userQuestion
              );
            const wantsTorchOff =
              /turn off light|turn off torch|flash off|light off|torch off|روشنی بند|ٹارچ بند/i.test(
                userQuestion
              );
            const isJustTorchCommand =
              /^(turn on light|turn on torch|flash on|light on|torch on|turn off light|turn off torch|flash off|light off|torch off|روشنی جلاؤ|ٹارچ چلاؤ|بتی جلاؤ|روشنی بند|ٹارچ بند)$/i.test(
                userQuestion.trim()
              );

            if (wantsTorchOn) {
              if (device?.hasTorch) {
                setTorchMode('on');
                if (isJustTorchCommand) {
                  speakText('Torch turned on.');
                  setStatusMessage('Torch On');
                  return;
                }
              } else {
                speakText('Flashlight is not available on this camera.');
                if (isJustTorchCommand) return;
              }
            } else if (wantsTorchOff) {
              setTorchMode('off');
              if (isJustTorchCommand) {
                speakText('Torch turned off.');
                setStatusMessage('Torch Off');
                return;
              }
            }

            const truncated = userQuestion.length > 20 ? userQuestion.slice(0, 18) + '...' : userQuestion;
            setStatusMessage(`Question: "${truncated}"`);
            captureAndAnalyze(userQuestion);
            return;
          }
        } catch (transErr) {
          console.warn(
            '[GuideMode] Question transcription failed, falling back to auto-scan:',
            transErr
          );
        }
      }

      // Silence or no speech detected during 2.5s -> Auto-capture and describe
      setStatusMessage('AI Analyzing...');
      captureAndAnalyze();
    }, 2500);
  }, [captureAndAnalyze, device, isProcessing, questionRecorder]);

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
    cancelQuestionListening();
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
  }, [cancelQuestionListening]);

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
        {hasPermission && device != null ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive}
            outputs={[photoOutput]}
            torchMode={device?.hasTorch && isCameraStarted ? torchMode : undefined}
            onStarted={() => setIsCameraStarted(true)}
            onStopped={() => setIsCameraStarted(false)}
            onError={handleCameraError}
          />
        ) : (
          <View style={styles.permissionFallback}>
            <Ionicons
              name={hasPermission ? 'camera-outline' : 'warning-outline'}
              size={48}
              color={THEME.colors.warning}
            />
            <Text style={styles.permissionText}>
              {hasPermission
                ? 'Initializing Camera Device...'
                : 'Camera Permission Required'}
            </Text>
            {!hasPermission && (
              <Pressable
                style={styles.permissionButton}
                onPress={() => requestPermission()}
              >
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </Pressable>
            )}
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
            <Text
              style={styles.statusPillText}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {statusMessage}
            </Text>
          </View>
        </View>

        {/* Gesture Guidance Footer (Zero-Vision Tactile Cue) */}
        <View style={styles.gestureHintBar} pointerEvents="none">
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText} numberOfLines={1}>1x: Scan</Text>
          </View>
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText} numberOfLines={1}>2x: Simplify</Text>
          </View>
          <View style={styles.gestureHintPill}>
            <Text style={styles.gestureHintText} numberOfLines={1}>Hold: Radar</Text>
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
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: '96%',
  },
  statusPillText: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  gestureHintBar: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 10,
  },
  gestureHintPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexShrink: 1,
  },
  gestureHintText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
