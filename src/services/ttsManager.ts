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
 * Retrieves and caches the native speech synthesis voices available on the device.
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
 * Speaks text using on-device expo-speech with automatic Urdu/English script routing,
 * distinct pitch/rate spread, and echo-prevention lifecycle callbacks.
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Stop any active speech first and wait 60ms for native audio session release
  try {
    await Speech.stop();
    await new Promise((resolve) => setTimeout(resolve, 60));
  } catch (stopErr) {
    console.warn('[TTSManager] Error stopping previous speech:', stopErr);
  }

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

  // Determine native voice identifier if available on device
  let matchedVoiceIdentifier: string | undefined;
  try {
    const available = await getAvailableNativeVoices();
    if (available && available.length > 0) {
      // Find voices matching the target language code
      const langMatches = available.filter((v) =>
        v.language.toLowerCase().startsWith(targetPreset.language.toLowerCase())
      );

      if (langMatches.length > 0) {
        // Look for gender hints in voice name or identifier
        const genderMatch = langMatches.find((v) =>
          v.name.toLowerCase().includes(targetPreset.gender) ||
          v.identifier.toLowerCase().includes(targetPreset.gender)
        );
        matchedVoiceIdentifier = (genderMatch ?? langMatches[0]).identifier;
      }
    }
  } catch (voiceErr) {
    console.warn('[TTSManager] Error matching native voice:', voiceErr);
  }

  // Trigger onStart before speech begins (invoking echo-gating pause on microphone)
  options.onStart?.();

  try {
    Speech.speak(trimmed, {
      language: targetPreset.language, // 'ur' or 'en' (never hyphenated to avoid Android IllformedLocaleException)
      pitch: targetPreset.pitch,
      rate: targetPreset.rate,
      voice: matchedVoiceIdentifier,
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
