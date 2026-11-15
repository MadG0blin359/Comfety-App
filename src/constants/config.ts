import { AppConfig, SensorThresholds, AudioMeteringConfig } from '../types';

export const AI_MODELS = {
  STT_MODEL: 'whisper-large-v3-turbo',
  VISION_PRIMARY_MODEL: 'gemini-3.8-flash',
  VISION_FAST_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
  LOCAL_TFLITE_MODEL: 'efficientdet-lite0.tflite',
} as const;

export const RATE_LIMITS = {
  GROQ_MIN_INTERVAL_MS: 4000,      // Max 15 RPM (Free tier ceiling: 20 RPM)
  GEMINI_HAZARD_INTERVAL_MS: 7000, // Max ~8.5 RPM (Free tier ceiling: ~10–15 RPM)
  TFLITE_INPUT_SIZE: 320,          // 320x320 RGB frame resize for efficientdet-lite0
} as const;

export const ENV_CONFIG = {
  GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
} as const;

export function validateApiKeys(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!ENV_CONFIG.GROQ_API_KEY.trim()) {
    missing.push('EXPO_PUBLIC_GROQ_API_KEY');
  }
  if (!ENV_CONFIG.GEMINI_API_KEY.trim()) {
    missing.push('EXPO_PUBLIC_GEMINI_API_KEY');
  }
  return {
    isValid: missing.length === 0,
    missing,
  };
}

export const SENSOR_THRESHOLDS: SensorThresholds = {
  shakeThresholdG: 2.1,         // Accelerometer spike magnitude for blind entry
  shakeWindowMs: 1000,          // Time window for two consecutive spikes
  shakeSamplingIntervalMs: 150, // Accelerometer polling interval
  longPressBlindEntryMs: 2000,  // 2s universal glass hold for Guide Mode
} as const;

export const AUDIO_METERING_CONFIG: AudioMeteringConfig = {
  rmsSilenceThresholdDb: -45, // Discard intervals quieter than -45dB
  chunkDurationMs: 4000,       // Utterance window
} as const;

export const STORAGE_KEYS = {
  PREFERRED_MODE: 'comfety_preferred_mode',
  AUTO_OPEN: 'comfety_auto_open',
  USER_CONTEXT: 'comfety_user_context',
  SAVED_PHRASES: 'comfety_saved_phrases',
  SELECTED_VOICE: 'comfety_selected_voice',
} as const;

export const APP_CONFIG: AppConfig = {
  groq: {
    apiKey: ENV_CONFIG.GROQ_API_KEY,
    model: AI_MODELS.STT_MODEL,
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    prompt: 'Urdu and English mixed conversation. السلام علیکم، یہ کتنے کا ہے؟',
    rateLimit: {
      minIntervalMs: RATE_LIMITS.GROQ_MIN_INTERVAL_MS,
      maxRpm: 20,
      retryBackoffMs: [2000, 4000, 8000],
      maxRetries: 3,
    },
  },
  gemini: {
    apiKey: ENV_CONFIG.GEMINI_API_KEY,
    visionModel: AI_MODELS.VISION_PRIMARY_MODEL,
    obstacleModel: AI_MODELS.VISION_FAST_FALLBACK_MODEL,
    obstacleRateLimit: {
      minIntervalMs: RATE_LIMITS.GEMINI_HAZARD_INTERVAL_MS,
      maxRpm: 15,
      retryBackoffMs: [2000, 4000, 8000],
      maxRetries: 3,
    },
    visionRateLimit: {
      minIntervalMs: 2000,
      maxRpm: 15,
      retryBackoffMs: [2000, 4000, 8000],
      maxRetries: 3,
    },
  },
  sensors: SENSOR_THRESHOLDS,
  audioMetering: AUDIO_METERING_CONFIG,
};
