import { AppState, AppStateStatus } from 'react-native';
import { VolumeManager, VolumeResult } from 'react-native-volume-manager';
import { AUDIO_CONFIG } from '../constants/config';

/**
 * Gets the current physical media volume level (0.0 to 1.0).
 * Safely defaults to 1.0 if unsupported or on error.
 */
export async function getCurrentVolume(): Promise<number> {
  try {
    const result: VolumeResult = await VolumeManager.getVolume();
    return typeof result?.volume === 'number' ? result.volume : 1.0;
  } catch (err: unknown) {
    console.warn('[VolumeService] Could not read device volume:', err);
    return 1.0;
  }
}

/**
 * Ensures the physical device media volume is at least `minThreshold` (default: 50% / 0.5).
 * If the current volume is below the threshold, it is automatically scaled up.
 * If the current volume is already at or above the threshold, it is left untouched.
 *
 * @param minThreshold Minimum volume floor between 0.0 and 1.0. Defaults to AUDIO_CONFIG.MINIMUM_VOLUME_THRESHOLD (0.5).
 * @returns The final active volume level.
 */
export async function ensureMinimumVolume(
  minThreshold: number = AUDIO_CONFIG.MINIMUM_VOLUME_THRESHOLD,
): Promise<number> {
  try {
    const current = await getCurrentVolume();
    if (current < minThreshold) {
      await VolumeManager.setVolume(minThreshold, {
        type: 'music',
        showUI: false,
        playSound: false,
      });
      console.log(
        `[VolumeService] Scaled device media volume from ${(current * 100).toFixed(0)}% to ${(minThreshold * 100).toFixed(0)}%`,
      );
      return minThreshold;
    }
    return current;
  } catch (err: unknown) {
    console.warn('[VolumeService] Failed to set minimum volume:', err);
    return minThreshold;
  }
}

/**
 * Subscribes to app state transitions to ensure the volume remains at least at `minThreshold`
 * whenever the user returns to the app from the background or lock screen.
 *
 * @param minThreshold Minimum volume floor.
 * @returns An unsubscribe cleanup function.
 */
export function setupVolumeForegroundSync(
  minThreshold: number = AUDIO_CONFIG.MINIMUM_VOLUME_THRESHOLD,
): () => void {
  const subscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        ensureMinimumVolume(minThreshold).catch((err: unknown) => {
          console.warn('[VolumeService] Error syncing volume on resume:', err);
        });
      }
    },
  );

  return () => {
    subscription.remove();
  };
}
