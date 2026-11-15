export type AppMode = 'conversation' | 'guide';

export type PermissionKind = 'microphone' | 'camera';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'blocked';

export interface PermissionCheckResult {
  granted: boolean;
  canAskAgain: boolean;
  status: PermissionState;
}

export interface PermissionsSnapshot {
  microphone: PermissionCheckResult;
  camera: PermissionCheckResult;
}

export interface UserAccessibilityContext {
  preferredMode: AppMode | null;
  autoOpen: boolean;
  explanationLevel: 'simple' | 'standard';
  selectedVoiceId?: string;
  emergencyNotes?: string;
}

export interface RateLimitPolicy {
  readonly minIntervalMs: number;
  readonly maxRpm: number;
  readonly retryBackoffMs: readonly number[];
  readonly maxRetries: number;
}

export interface SensorThresholds {
  readonly shakeThresholdG: number;
  readonly shakeWindowMs: number;
  readonly shakeSamplingIntervalMs: number;
  readonly longPressBlindEntryMs: number;
}

export interface AudioMeteringConfig {
  readonly rmsSilenceThresholdDb: number;
  readonly chunkDurationMs: number;
}

export interface AppConfig {
  readonly groq: {
    readonly apiKey: string;
    readonly model: 'whisper-large-v3-turbo';
    readonly endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions';
    readonly prompt: string;
    readonly rateLimit: RateLimitPolicy;
  };
  readonly gemini: {
    readonly apiKey: string;
    readonly visionModel: 'gemini-3.8-flash';
    readonly obstacleModel: 'gemini-3.5-flash-lite';
    readonly obstacleRateLimit: RateLimitPolicy;
    readonly visionRateLimit: RateLimitPolicy;
  };
  readonly sensors: SensorThresholds;
  readonly audioMetering: AudioMeteringConfig;
}

export interface NavigationRouteCard {
  mode: AppMode;
  title: string;
  subtitle: string;
  route: '/conversation' | '/guide';
  badgeText: string;
  badgeIcon: string;
}

export interface TranscriptItem {
  id: string;
  text: string;
  sender: 'partner' | 'user';
  timestamp: number;
  isUrdu?: boolean;
}

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

export interface TtsVoicePreset {
  id: string;
  name: string;
  language: string;
  pitch: number;
  rate: number;
  gender: 'female' | 'male';
  regionLabel: string;
  samplePhrase: string;
}

export interface QuickReplyItem {
  id: string;
  labelEn: string;
  labelUr: string;
  spokenText: string;
  category?: 'greeting' | 'commerce' | 'clarification' | 'navigation' | 'urgent' | 'custom';
  isCustom?: boolean;
}

