import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TtsVoicePreset } from '../types';
import { STORAGE_KEYS } from '../constants/config';
import { isUrduScript } from './groqStt';

export const TTS_VOICE_PRESETS: readonly TtsVoicePreset[] = [
  {
    id: 'ur-fatima',
    name: 'Fatima',
    language: 'ur',
    pitch: 1.18,
    rate: 0.92,
    gender: 'female',
    regionLabel: 'Urdu (Warm Female)',
    samplePhrase: 'السلام علیکم، میں آپ کی کیا مدد کر سکتی ہوں؟',
  },
  {
    id: 'ur-tariq',
    name: 'Tariq',
    language: 'ur',
    pitch: 0.78,
    rate: 0.88,
    gender: 'male',
    regionLabel: 'Urdu (Calm Male)',
    samplePhrase: 'السلام علیکم، میں آپ کا معاون ہوں۔',
  },
  {
    id: 'en-sarah',
    name: 'Sarah',
    language: 'en',
    pitch: 1.15,
    rate: 0.95,
    gender: 'female',
    regionLabel: 'English (US Clear)',
    samplePhrase: 'Hello, how can I help you today?',
  },
  {
    id: 'en-david',
    name: 'David',
    language: 'en',
    pitch: 0.75,
    rate: 0.90,
    gender: 'male',
    regionLabel: 'English (US Deep)',
    samplePhrase: 'Hello, I am ready to assist you.',
  },
  {
    id: 'en-emma',
    name: 'Emma',
    language: 'en',
    pitch: 1.05,
    rate: 1.04,
    gender: 'female',
    regionLabel: 'English (UK Friendly)',
    samplePhrase: 'Good day! Lovely to meet you.',
  },
  {
    id: 'en-oliver',
    name: 'Oliver',
    language: 'en',
    pitch: 0.85,
    rate: 0.88,
    gender: 'male',
    regionLabel: 'English (UK Warm)',
    samplePhrase: 'Hello there, hope you are having a pleasant day.',
  },
] as const;

export const DEFAULT_VOICE_ID = 'ur-fatima';

let cachedVoices: Speech.Voice[] | null = null;

/**
 * Pre-warms and caches available native voices in background so speakText never blocks on IPC.
 */
export async function getAvailableNativeVoices(): Promise<Speech.Voice[]> {
  if (cachedVoices && cachedVoices.length > 0) {
    return cachedVoices;
  }
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    cachedVoices = voices;
    return voices;
  } catch (err) {
    console.warn('[TTSManager] Failed to query native voices:', err);
    return [];
  }
}

// Background pre-fetch on module evaluation
getAvailableNativeVoices().catch(() => {});

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
 * Synchronous voice matching from pre-cached system voices. Zero IPC overhead.
 */
function findMatchingVoiceIdentifier(targetLang: string, targetGender: 'female' | 'male'): string | undefined {
  if (!cachedVoices || cachedVoices.length === 0) return undefined;

  const langMatches = cachedVoices.filter((v) =>
    v.language.toLowerCase().startsWith(targetLang.toLowerCase())
  );

  if (langMatches.length === 0) return undefined;

  const genderMatch = langMatches.find((v) =>
    v.name.toLowerCase().includes(targetGender) ||
    v.identifier.toLowerCase().includes(targetGender)
  );

  return (genderMatch ?? langMatches[0]).identifier;
}

/**
 * Speaks text using on-device expo-speech with zero perceived delay,
 * automatic Urdu/English script routing, and echo-prevention lifecycle callbacks.
 */
export function speakText(text: string, options: SpeakOptions = {}): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Stop any active utterance without blocking
  Speech.stop().catch(() => {});

  const isUrdu = isUrduScript(trimmed);

  // Find requested preset
  const selectedPreset =
    TTS_VOICE_PRESETS.find((v) => v.id === options.voiceId) ?? TTS_VOICE_PRESETS[0];

  let targetPreset = selectedPreset;

  // If text is Urdu script but user chose an English preset, map to the corresponding gender-matched Urdu preset
  if (isUrdu && selectedPreset.language !== 'ur') {
    const matchingUrdu = TTS_VOICE_PRESETS.find(
      (v) => v.language === 'ur' && v.gender === selectedPreset.gender
    ) ?? TTS_VOICE_PRESETS[0];
    targetPreset = matchingUrdu;
  }

  // Fast synchronous voice match from cached voices
  const matchedVoice = findMatchingVoiceIdentifier(targetPreset.language, targetPreset.gender);

  // Trigger onStart before speech begins (invoking echo-gating pause on microphone)
  options.onStart?.();

  try {
    Speech.speak(trimmed, {
      language: targetPreset.language, // 'ur' or 'en'
      pitch: targetPreset.pitch,
      rate: targetPreset.rate,
      voice: matchedVoice,
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
  } catch (speakErr) {
    console.error('[TTSManager] Failed to invoke Speech.speak:', speakErr);
    options.onError?.(speakErr instanceof Error ? speakErr : new Error(String(speakErr)));
    options.onDone?.();
  }
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
