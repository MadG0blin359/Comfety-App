import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import { SENSOR_THRESHOLDS } from '../constants/config';

interface UseShakeGestureOptions {
  enabled: boolean;
  onShake: () => void;
}

export function useShakeGesture({ enabled, onShake }: UseShakeGestureOptions): void {
  const lastSpikeTimestampRef = useRef<number>(0);
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCancelled = false;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || isCancelled) return;

        Accelerometer.setUpdateInterval(SENSOR_THRESHOLDS.shakeSamplingIntervalMs);

        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // Total acceleration in G's
          const magnitudeG = Math.sqrt(x * x + y * y + z * z);

          if (magnitudeG > SENSOR_THRESHOLDS.shakeThresholdG) {
            const now = Date.now();
            const timeSinceLastSpike = now - lastSpikeTimestampRef.current;

            // Distinct second spike within the 1000ms window (with >= 200ms debounce)
            if (timeSinceLastSpike >= 200 && timeSinceLastSpike <= SENSOR_THRESHOLDS.shakeWindowMs) {
              lastSpikeTimestampRef.current = 0; // Reset after trigger
              onShakeRef.current();
            } else if (timeSinceLastSpike > SENSOR_THRESHOLDS.shakeWindowMs) {
              lastSpikeTimestampRef.current = now;
            }
          }
        });
      })
      .catch((err) => {
        console.warn('[useShakeGesture] Accelerometer check failed:', err);
      });

    return () => {
      isCancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
