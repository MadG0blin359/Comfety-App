import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TtsVoicePreset } from '../types';
import { STORAGE_KEYS } from '../constants/config';
import { isUrduScript } from './groqStt';

export const TTS_VOICE_PRESETS: readonly TtsVoicePreset[] = [
  {
    id: 'ur-fatima',
    name: 'Fatima',
    language: 'ur-PK',
    pitch: 1.05,
    rate: 0.92,
    gender: 'female',
    regionLabel: 'Urdu (Pakistan)',
    samplePhrase: 'السلام علیکم، میں آپ کی کیا مدد کر سکتی ہوں؟',
  },
  {
    id: 'ur-tariq',
    name: 'Tariq',
    language: 'ur-PK',
    pitch: 0.90,
    rate: 0.90,
    gender: 'male',
    regionLabel: 'Urdu (Pakistan)',
    samplePhrase: 'السلام علیکم، میں بالکل ٹھیک ہوں۔',
  },
  {
    id: 'en-sarah',
    name: 'Sarah',
    language: 'en-US',
    pitch: 1.05,
    rate: 0.95,
    gender: 'female',
    regionLabel: 'English (US)',
    samplePhrase: 'Hello, how can I help you today?',
  },
  {
    id: 'en-david',
    name: 'David',
    language: 'en-US',
    pitch: 0.88,
    rate: 0.92,
    gender: 'male',
    regionLabel: 'English (US)',
    samplePhrase: 'Hello, please let me know what you need.',
  },
  {
    id: 'en-emma',
    name: 'Emma',
    language: 'en-GB',
    pitch: 1.02,
    rate: 0.94,
    gender: 'female',
    regionLabel: 'English (UK)',
    samplePhrase: 'Good day, lovely to meet you.',
  },
  {
    id: 'en-oliver',
    name: 'Oliver',
    language: 'en-GB',
    pitch: 0.92,
    rate: 0.92,
    gender: 'male',
    regionLabel: 'English (UK)',
    samplePhrase: 'Hello there, hope you are having a pleasant day.',
  },
] as const;

export const DEFAULT_VOICE_ID = 'ur-fatima';

/**
 * Loads the user's persisted voice preference from AsyncStorage.
 */
export async function loadSelectedVoiceId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_VOICE);
    if (saved && TTS_VOICE_PRESETS.some((v) => v.id === saved)) {
      return saved;
    }
  } catch (err) {
    console.warn('[TTSManager] Failed to load selected voice from storage:', err);
  }
  return DEFAULT_VOICE_ID;
}

/**
 * Persists the user's chosen voice ID to AsyncStorage.
 */
export async function saveSelectedVoiceId(voiceId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, voiceId);
  } catch (err) {
    console.error('[TTSManager] Failed to persist selected voice:', err);
  }
}

export interface SpeakOptions {
  voiceId?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Speaks text using on-device expo-speech with automatic Urdu/English script routing
 * and echo-prevention lifecycle callbacks.
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Stop any active speech first
  try {
    await Speech.stop();
  } catch (stopErr) {
    console.warn('[TTSManager] Error stopping previous speech:', stopErr);
  }

  const isUrdu = isUrduScript(trimmed);

  // If text is Urdu script, pick an Urdu voice preset. Otherwise use requested or default voice.
  let activePreset = TTS_VOICE_PRESETS.find((v) => v.id === options.voiceId) ?? TTS_VOICE_PRESETS[0];

  if (isUrdu && !activePreset.language.startsWith('ur')) {
    // If the active preset is English but text is Urdu, map to corresponding Urdu voice (matching gender)
    const urduMatch = TTS_VOICE_PRESETS.find(
      (v) => v.language.startsWith('ur') && v.gender === activePreset.gender
    ) ?? TTS_VOICE_PRESETS[0];
    activePreset = urduMatch;
  }

  // Trigger onStart before speech begins (invoking echo-gating pause on microphone)
  options.onStart?.();

  Speech.speak(trimmed, {
    language: activePreset.language,
    pitch: activePreset.pitch,
    rate: activePreset.rate,
    onDone: () => {
      options.onDone?.();
    },
    onStopped: () => {
      options.onDone?.();
    },
    onError: (err) => {
      console.warn('[TTSManager] Speech synthesis error:', err);
      options.onError?.(new Error(String(err)));
      options.onDone?.();
    },
  });
}

/**
 * Immediately halts active speech synthesis.
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (err) {
    console.warn('[TTSManager] Failed to stop speech:', err);
  }
}

/**
 * Checks whether speech synthesis is actively playing.
 */
export async function isSpeakingAsync(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
