import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { LightSensor, LightSensorMeasurement } from 'expo-sensors';

interface UseAutoTorchOptions {
  hasTorch: boolean;
  isCameraStarted: boolean;
  enabled?: boolean;
}

interface UseAutoTorchReturn {
  torchMode: 'off' | 'on' | undefined;
  isLowLight: boolean;
  currentLux: number | null;
  setTorchManual: (mode: 'off' | 'on') => void;
  resetTorchOverride: () => void;
}

// Hysteresis thresholds to prevent rapid strobing
const LOW_LIGHT_THRESHOLD_LUX = 15;     // Lux level below which room is dark
const BRIGHT_LIGHT_THRESHOLD_LUX = 45;  // Lux level above which ambient light is sufficient
const SENSOR_UPDATE_INTERVAL_MS = 500;  // 500ms sensor polling
const REQUIRED_CONSECUTIVE_LOW_READINGS = 2;    // 1000ms sustained darkness
const REQUIRED_CONSECUTIVE_BRIGHT_READINGS = 3; // 1500ms sustained brightness

export function useAutoTorch({
  hasTorch,
  isCameraStarted,
  enabled = true,
}: UseAutoTorchOptions): UseAutoTorchReturn {
  const [torchMode, setTorchMode] = useState<'off' | 'on'>('off');
  const [isLowLight, setIsLowLight] = useState<boolean>(false);
  const [currentLux, setCurrentLux] = useState<number | null>(null);

  const consecutiveLowRef = useRef<number>(0);
  const consecutiveBrightRef = useRef<number>(0);
  const userOverriddenRef = useRef<boolean>(false);

  // Manual voice or gesture override (e.g. user says "Turn off light" or "Turn on light")
  const setTorchManual = useCallback((mode: 'off' | 'on') => {
    userOverriddenRef.current = true;
    setTorchMode(mode);
    setIsLowLight(mode === 'on');
  }, []);

  const resetTorchOverride = useCallback(() => {
    userOverriddenRef.current = false;
  }, []);

  useEffect(() => {
    // Sensor only active when camera is started and hardware has flash
    if (!enabled || !hasTorch || !isCameraStarted) {
      return;
    }

    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    async function initLightSensor() {
      try {
        const available = await LightSensor.isAvailableAsync();
        if (!available || !isMounted) {
          return;
        }

        LightSensor.setUpdateInterval(SENSOR_UPDATE_INTERVAL_MS);

        subscription = LightSensor.addListener((data: LightSensorMeasurement) => {
          if (!isMounted) return;

          const lux = data.illuminance;
          setCurrentLux(lux);

          // If user explicitly overrode torch via voice command ("Turn off light"), respect choice
          if (userOverriddenRef.current) {
            return;
          }

          if (lux < LOW_LIGHT_THRESHOLD_LUX) {
            consecutiveBrightRef.current = 0;
            consecutiveLowRef.current += 1;

            if (consecutiveLowRef.current >= REQUIRED_CONSECUTIVE_LOW_READINGS) {
              setIsLowLight(true);
              setTorchMode('on');
            }
          } else if (lux > BRIGHT_LIGHT_THRESHOLD_LUX) {
            consecutiveLowRef.current = 0;
            consecutiveBrightRef.current += 1;

            if (consecutiveBrightRef.current >= REQUIRED_CONSECUTIVE_BRIGHT_READINGS) {
              setIsLowLight(false);
              setTorchMode('off');
            }
          } else {
            // In the hysteresis band (15–45 lux): preserve existing torch state
            consecutiveLowRef.current = 0;
            consecutiveBrightRef.current = 0;
          }
        });
      } catch (err: unknown) {
        console.warn('[AutoTorch] Ambient light sensor initialization error:', err);
      }
    }

    initLightSensor();

    // Turn off torch immediately whenever the app is backgrounded
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        setTorchMode('off');
      }
    });

    return () => {
      isMounted = false;
      subscription?.remove();
      appStateSub.remove();
      setTorchMode('off');
    };
  }, [enabled, hasTorch, isCameraStarted]);

  return {
    torchMode: enabled && hasTorch && isCameraStarted ? torchMode : undefined,
    isLowLight,
    currentLux,
    setTorchManual,
    resetTorchOverride,
  };
}
