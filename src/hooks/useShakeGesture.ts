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
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    Accelerometer.setUpdateInterval(SENSOR_THRESHOLDS.shakeSamplingIntervalMs);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
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

    return () => {
      subscription.remove();
    };
  }, [enabled]);
}
