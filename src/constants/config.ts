import { AppConfig, RateLimitPolicy, SensorThresholds, AudioMeteringConfig } from '../types';

export const RATE_LIMITS: {
  readonly GROQ_STT: RateLimitPolicy;
  readonly GEMINI_OBSTACLES: RateLimitPolicy;
  readonly GEMINI_VISION: RateLimitPolicy;
} = {
  GROQ_STT: {
    minIntervalMs: 4000, // Strictly >= 4,000ms between audio chunk uploads
    maxRpm: 20,          // Groq Whisper-large-v3-turbo free tier limit
    retryBackoffMs: [2000, 4000, 8000],
    maxRetries: 3,
  },
  GEMINI_OBSTACLES: {
    minIntervalMs: 7000, // Strictly >= 7,000ms (<= 8.5 RPM) for continuous hazard checks
    maxRpm: 15,
    retryBackoffMs: [2000, 4000, 8000],
    maxRetries: 3,
  },
  GEMINI_VISION: {
    minIntervalMs: 2000, // On-demand user action OCR / Simplification
    maxRpm: 15,
    retryBackoffMs: [2000, 4000, 8000],
    maxRetries: 3,
  },
} as const;

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

const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

if (!groqApiKey && !__DEV__) {
  console.warn('[Comfety Config] Warning: EXPO_PUBLIC_GROQ_API_KEY is not defined.');
}

if (!geminiApiKey && !__DEV__) {
  console.warn('[Comfety Config] Warning: EXPO_PUBLIC_GEMINI_API_KEY is not defined.');
}

export const APP_CONFIG: AppConfig = {
  groq: {
    apiKey: groqApiKey,
    model: 'whisper-large-v3-turbo',
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    prompt: 'Urdu and English mixed conversation. السلام علیکم، یہ کتنے کا ہے؟',
    rateLimit: RATE_LIMITS.GROQ_STT,
  },
  gemini: {
    apiKey: geminiApiKey,
    visionModel: 'gemini-3.8-flash',
    obstacleModel: 'gemini-3.5-flash-lite',
    obstacleRateLimit: RATE_LIMITS.GEMINI_OBSTACLES,
    visionRateLimit: RATE_LIMITS.GEMINI_VISION,
  },
  sensors: SENSOR_THRESHOLDS,
  audioMetering: AUDIO_METERING_CONFIG,
};
