/* eslint-disable react-hooks/immutability */
import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizer, type GPUFrame } from 'react-native-vision-camera-resizer';
import { useFrameOutput, Frame } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import { speakText, stopSpeech } from '../services/ttsManager';
import { checkStructuralHazards } from '../services/geminiVision';
import { RATE_LIMITS } from '../constants/config';

interface UseObstacleLoopOptions {
  isRadarActive: boolean;
  isCameraActive: boolean;
  isCameraStarted: boolean;
  capturePhotoForHazard?: () => Promise<string | null>; // Returns base64 JPEG for 7s structural hazard check
}

interface ObstacleDetection {
  classId: number;
  label: string;
  score: number;
  direction: 'left' | 'center' | 'right';
  isClose: boolean;
}

// COCO classes mapped in Google's EfficientDet-Lite0
const COCO_CLASS_NAMES: Record<number, string> = {
  0: 'Person',
  1: 'Bicycle',
  2: 'Car',
  3: 'Motorcycle',
  5: 'Bus',
  7: 'Truck',
};

const TARGET_CLASS_IDS = new Set([0, 1, 2, 3, 5, 7]);
const CONFIDENCE_THRESHOLD = 0.55;
const ALERT_COOLDOWN_MS = 3500;
const STRUCTURAL_CHECK_INTERVAL_MS = RATE_LIMITS.GEMINI_HAZARD_INTERVAL_MS; // 7,000ms

export function useObstacleLoop({
  isRadarActive,
  isCameraActive,
  isCameraStarted,
  capturePhotoForHazard,
}: UseObstacleLoopOptions) {
  const [activeObstacleWarning, setActiveObstacleWarning] = useState<string | null>(null);
  const [isWalking, setIsWalking] = useState<boolean>(false);

  // Load official Google quantized EfficientDet-Lite0 model from assets
  const tflite = useTensorflowModel(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/models/efficientdet-lite0.tflite'),
    []
  );

  // Resize camera frames to 320x320 uint8 RGB as required by EfficientDet-Lite0
  const { resizer } = useResizer({
    width: 320,
    height: 320,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'cover',
    pixelLayout: 'interleaved',
  });

  const lastAlertTimestampRef = useRef<number>(0);
  const lastAlertLabelRef = useRef<string>('');
  const lastWalkingSpikeRef = useRef<number>(0);
  const decayCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isWalkingRef = useRef<boolean>(false);
  const isStructuralCheckInFlightRef = useRef<boolean>(false);

  // Worklet-safe shared values across native frame processor thread and Hermes
  const consecutiveClassId = useSharedValue<number>(-1);
  const consecutiveCount = useSharedValue<number>(0);
  const lastFrameTimestamp = useSharedValue<number>(0);

  // Priority Audio & Haptic Interrupt dispatched back to the React JS thread
  const triggerPriorityAlert = useCallback((warningText: string, obstacleKey: string) => {
    const now = Date.now();
    // Enforce 1800ms minimum silence buffer between any alerts to avoid speech overlap
    // and 3.5s cooldown for the identical obstacle
    if (
      now - lastAlertTimestampRef.current < 1800 ||
      (now - lastAlertTimestampRef.current < ALERT_COOLDOWN_MS &&
        lastAlertLabelRef.current === obstacleKey)
    ) {
      return;
    }

    if (AppState.currentState !== 'active') {
      return;
    }

    lastAlertTimestampRef.current = now;
    lastAlertLabelRef.current = obstacleKey;
    setActiveObstacleWarning(warningText);

    // 1. Immediately cut off any ongoing reading or scene explanation
    stopSpeech().catch((err) =>
      console.warn('[ObstacleLoop] Failed to stop speech on priority alert:', err)
    );

    // 2. High-priority tactile alert (Error buzz pattern)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch((err) =>
      console.warn('[ObstacleLoop] Failed to trigger priority haptics:', err)
    );

    // 3. Speak concise warning in <= 5 words
    speakText(warningText).catch((err) =>
      console.warn('[ObstacleLoop] Failed to speak priority obstacle warning:', err)
    );

    // Clear warning display after alert duration
    setTimeout(() => {
      setActiveObstacleWarning((prev) => (prev === warningText ? null : prev));
    }, ALERT_COOLDOWN_MS);
  }, []);

  const onObstacleDetectedJS = useRunOnJS(
    (classId: number, direction: 'left' | 'center' | 'right', isClose: boolean) => {
      const name = COCO_CLASS_NAMES[classId] ?? 'Obstacle';
      const isVehicle = classId === 2 || classId === 3 || classId === 5 || classId === 7;
      const baseName = isVehicle ? 'Vehicle' : name;

      let warning = `${baseName} ahead`;
      if (isClose) {
        warning = `${baseName} close ahead`;
      } else if (direction === 'left') {
        warning = `${baseName} on left`;
      } else if (direction === 'right') {
        warning = `${baseName} on right`;
      }

      const obstacleKey = `${classId}-${direction}-${isClose ? 'close' : 'far'}`;
      triggerPriorityAlert(warning, obstacleKey);
    },
    [triggerPriorityAlert]
  );

  // Worklet frame processor running at >= 10 FPS
  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame: Frame) {
      'worklet';
      if (!isRadarActive || !isCameraActive || resizer == null || tflite.model == null) {
        frame.dispose();
        return;
      }

      // Throttle frame processing to ~10 FPS (100ms per frame) to preserve battery
      const now = Date.now();
      if (now - lastFrameTimestamp.value < 100) {
        frame.dispose();
        return;
      }
      lastFrameTimestamp.value = now;

      let resized: GPUFrame | null = null;
      try {
        resized = resizer.resize(frame);
        const buffer = resized.getPixelBuffer();
        const outputs = tflite.model.runSync([buffer]);

        if (!outputs || outputs.length < 4) {
          return;
        }

        const boxes = new Float32Array(outputs[0]);
        const classes = new Float32Array(outputs[1]);
        const scores = new Float32Array(outputs[2]);
        const numDetectionsRaw = new Float32Array(outputs[3])[0];
        const numDetections = Math.min(Math.round(numDetectionsRaw || 0), 10);

        let highestConfidence = 0;
        let bestDetection: ObstacleDetection | null = null;

        for (let i = 0; i < numDetections; i++) {
          const score = scores[i] ?? 0;
          if (score < CONFIDENCE_THRESHOLD) continue;

          const classId = Math.round(classes[i] ?? -1);
          if (!TARGET_CLASS_IDS.has(classId)) continue;

          if (score > highestConfidence) {
            highestConfidence = score;

            const ymin = boxes[i * 4] ?? 0;
            const xmin = boxes[i * 4 + 1] ?? 0;
            const ymax = boxes[i * 4 + 2] ?? 1;
            const xmax = boxes[i * 4 + 3] ?? 1;

            const xCenter = (xmin + xmax) / 2;
            const boxHeight = ymax - ymin;

            let direction: 'left' | 'center' | 'right' = 'center';
            if (xCenter < 0.35) {
              direction = 'left';
            } else if (xCenter > 0.65) {
              direction = 'right';
            }

            bestDetection = {
              classId,
              label: COCO_CLASS_NAMES[classId] ?? 'Obstacle',
              score,
              direction,
              isClose: boxHeight > 0.55,
            };
          }
        }

        if (bestDetection != null) {
          // Strictly consecutive detection: reset count if class changes
          if (consecutiveClassId.value === bestDetection.classId) {
            consecutiveCount.value = consecutiveCount.value + 1;
          } else {
            consecutiveClassId.value = bestDetection.classId;
            consecutiveCount.value = 1;
          }

          // Require >= 0.55 confidence across 2 consecutive frames of the same class
          if (consecutiveCount.value >= 2) {
            onObstacleDetectedJS(bestDetection.classId, bestDetection.direction, bestDetection.isClose);
            consecutiveCount.value = 0;
          }
        } else {
          consecutiveClassId.value = -1;
          consecutiveCount.value = 0;
        }
      } catch (err) {
        console.warn('[ObstacleLoop] Frame processing error:', err);
      } finally {
        resized?.dispose();
        frame.dispose();
      }
    },
  });

  // Accelerometer walking motion detection for structural hazard gating with 2500ms step decay window
  useEffect(() => {
    if (!isRadarActive || !isCameraActive) {
      isWalkingRef.current = false;
      return;
    }

    Accelerometer.setUpdateInterval(250);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Total acceleration magnitude in Gs
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      // Heel strike oscillation produces 1.25g to 1.8g acceleration spikes
      if (magnitude > 1.25) {
        lastWalkingSpikeRef.current = Date.now();
        if (!isWalkingRef.current) {
          isWalkingRef.current = true;
          setIsWalking(true);
        }
      }
    });

    // 2500ms step decay window: periodically check if no steps were taken for > 2.5s
    decayCheckTimerRef.current = setInterval(() => {
      const elapsedSinceSpike = Date.now() - lastWalkingSpikeRef.current;
      if (isWalkingRef.current && elapsedSinceSpike >= 2500) {
        isWalkingRef.current = false;
        setIsWalking(false);
      }
    }, 500);

    return () => {
      subscription.remove();
      if (decayCheckTimerRef.current) {
        clearInterval(decayCheckTimerRef.current);
        decayCheckTimerRef.current = null;
      }
      isWalkingRef.current = false;
      setIsWalking(false);
    };
  }, [isRadarActive, isCameraActive]);

  // Throttled 7-second structural hazard loop (Stairs & Open Drains)
  useEffect(() => {
    if (!isRadarActive || !isCameraActive || !isCameraStarted || !capturePhotoForHazard) {
      return;
    }

    const abortController = new AbortController();

    const intervalTimer = setInterval(async () => {
      // Only query Gemini for structural drop hazards if the user is actively walking
      if (!isWalkingRef.current || isStructuralCheckInFlightRef.current) {
        return;
      }

      if (AppState.currentState !== 'active') {
        return;
      }

      isStructuralCheckInFlightRef.current = true;
      try {
        const base64Jpeg = await capturePhotoForHazard();
        if (base64Jpeg && isWalkingRef.current && AppState.currentState === 'active') {
          const result = await checkStructuralHazards(base64Jpeg, {
            signal: abortController.signal,
          });
          if (result.hasHazard && result.warning && isRadarActive) {
            triggerPriorityAlert(result.warning, result.hazardType ?? 'structural');
          }
        }
      } catch (err: unknown) {
        if (!abortController.signal.aborted) {
          console.warn('[ObstacleLoop] Structural hazard check error:', err);
        }
      } finally {
        isStructuralCheckInFlightRef.current = false;
      }
    }, STRUCTURAL_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalTimer);
      abortController.abort();
      isStructuralCheckInFlightRef.current = false;
    };
  }, [
    isRadarActive,
    isCameraActive,
    isCameraStarted,
    capturePhotoForHazard,
    triggerPriorityAlert,
  ]);

  return {
    frameOutput,
    modelState: tflite.state,
    activeObstacleWarning,
    isWalking,
  };
}
