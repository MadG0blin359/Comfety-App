import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizer } from 'react-native-vision-camera-resizer';
import { useFrameOutput, Frame } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';

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
  const consecutiveDetectionsRef = useRef<Record<number, number>>({});
  const lastFrameTimestampRef = useRef<number>(0);
  const isWalkingRef = useRef<boolean>(false);
  const isStructuralCheckInFlightRef = useRef<boolean>(false);

  // Priority Audio & Haptic Interrupt dispatched back to the React JS thread
  const triggerPriorityAlert = useCallback((warningText: string, obstacleKey: string) => {
    const now = Date.now();
    // 3.5s cooldown per obstacle type to avoid overwhelming the blind user with repeated speech
    if (
      now - lastAlertTimestampRef.current < ALERT_COOLDOWN_MS &&
      lastAlertLabelRef.current === obstacleKey
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
    stopSpeech().catch(() => {});

    // 2. High-priority tactile alert (Error buzz pattern)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

    // 3. Speak concise warning in <= 5 words
    speakText(warningText).catch(() => {});

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
      if (now - lastFrameTimestampRef.current < 100) {
        frame.dispose();
        return;
      }
      lastFrameTimestampRef.current = now;

      try {
        const resized = resizer.resize(frame);
        const buffer = resized.getPixelBuffer();
        const outputs = tflite.model.runSync([buffer]);

        resized.dispose();
        frame.dispose();

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
          const cid = bestDetection.classId;
          const currentCount = (consecutiveDetectionsRef.current[cid] ?? 0) + 1;
          consecutiveDetectionsRef.current[cid] = currentCount;

          // Require >= 0.55 confidence across 2 consecutive frames
          if (currentCount >= 2) {
            onObstacleDetectedJS(bestDetection.classId, bestDetection.direction, bestDetection.isClose);
            consecutiveDetectionsRef.current[cid] = 0;
          }
        } else {
          consecutiveDetectionsRef.current = {};
        }
      } catch {
        frame.dispose();
      }
    },
  });

  // Accelerometer walking motion detection for structural hazard gating
  useEffect(() => {
    if (!isRadarActive || !isCameraActive) {
      isWalkingRef.current = false;
      return;
    }

    Accelerometer.setUpdateInterval(500);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Total acceleration magnitude in Gs
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      // Walking step oscillation typically produces 1.2g to 1.8g spikes
      const walkingNow = magnitude > 1.25;

      if (walkingNow !== isWalkingRef.current) {
        isWalkingRef.current = walkingNow;
        setIsWalking(walkingNow);
      }
    });

    return () => {
      subscription.remove();
      isWalkingRef.current = false;
    };
  }, [isRadarActive, isCameraActive]);

  // Throttled 7-second structural hazard loop (Stairs & Open Drains)
  useEffect(() => {
    if (!isRadarActive || !isCameraActive || !isCameraStarted || !capturePhotoForHazard) {
      return;
    }

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
          const result = await checkStructuralHazards(base64Jpeg);
          if (result.hasHazard && result.warning && isRadarActive) {
            triggerPriorityAlert(result.warning, result.hazardType ?? 'structural');
          }
        }
      } catch (err: unknown) {
        console.warn('[ObstacleLoop] Structural hazard check error:', err);
      } finally {
        isStructuralCheckInFlightRef.current = false;
      }
    }, STRUCTURAL_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalTimer);
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
