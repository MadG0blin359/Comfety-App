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
    pitch: 1.02,
    rate: 0.95,
    gender: 'female',
    regionLabel: 'Urdu (ur-PK Natural)',
    samplePhrase: 'السلام علیکم، میں آپ کی کیا مدد کر سکتی ہوں؟',
  },
  {
    id: 'ur-zara',
    name: 'Zara',
    language: 'ur',
    pitch: 0.95,
    rate: 0.90,
    gender: 'female',
    regionLabel: 'Urdu (ur-PK Deep & Slow)',
    samplePhrase: 'السلام علیکم، میں آپ کی کیا مدد کر سکتی ہوں؟',
  },
  {
    id: 'en-in-tariq',
    name: 'Tariq',
    language: 'en',
    pitch: 0.96,
    rate: 0.94,
    gender: 'male',
    regionLabel: 'South Asian (en-IN Male)',
    samplePhrase: 'Hello, I am ready to assist you. میں آپ کی مدد کے لیے تیار ہوں۔',
  },
  {
    id: 'en-david',
    name: 'David',
    language: 'en',
    pitch: 0.96,
    rate: 0.96,
    gender: 'male',
    regionLabel: 'English (US Male)',
    samplePhrase: 'Hello, I am ready to assist you.',
  },
  {
    id: 'en-oliver',
    name: 'Oliver',
    language: 'en',
    pitch: 0.98,
    rate: 0.95,
    gender: 'male',
    regionLabel: 'English (UK Male)',
    samplePhrase: 'Hello there, hope you are having a pleasant day.',
  },
  {
    id: 'en-sarah',
    name: 'Sarah',
    language: 'en',
    pitch: 1.04,
    rate: 0.98,
    gender: 'female',
    regionLabel: 'English (US Female)',
    samplePhrase: 'Hello, how can I help you today?',
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
 * Synchronous voice matching for verified neural identifiers without pitch distortion.
 * - tpd, iom for en-US male
 * - rjs, gbb, gbd for en-GB male
 * - end, ene for en-IN male
 * - sfg, tpf for en-US female
 * - cfc for ur-PK female
 * Note: 'iob' is excluded as it is a female Google TTS voice.
 */
function findMatchingVoiceIdentifier(
  preset: TtsVoicePreset,
  targetLang: string
): string | undefined {
  if (!cachedVoices || cachedVoices.length === 0) return undefined;

  // 1. Preset-specific verified neural identifier match
  if (preset.id === 'en-in-tariq' || preset.name === 'Tariq') {
    const match = cachedVoices.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      const isIndian =
        lower.includes('en-in') || lower.includes('en_in') || v.language.toLowerCase().includes('in');
      return isIndian && (lower.includes('end') || lower.includes('ene') || lower.includes('male'));
    });
    if (match) return match.identifier;
  }

  if (preset.id === 'en-david' || preset.name === 'David') {
    const match = cachedVoices.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return (
        (lower.includes('tpd') || lower.includes('iom') || lower.includes('david')) &&
        !lower.includes('iob')
      );
    });
    if (match) return match.identifier;
  }

  if (preset.id === 'en-oliver' || preset.name === 'Oliver') {
    const match = cachedVoices.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return (
        lower.includes('rjs') ||
        lower.includes('gbb') ||
        lower.includes('gbd') ||
        lower.includes('oliver')
      );
    });
    if (match) return match.identifier;
  }

  if (preset.id === 'en-sarah' || preset.name === 'Sarah') {
    const match = cachedVoices.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return lower.includes('sfg') || lower.includes('tpf') || lower.includes('sarah');
    });
    if (match) return match.identifier;
  }

  if (preset.id === 'ur-fatima' || preset.id === 'ur-zara' || targetLang === 'ur') {
    const match = cachedVoices.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return lower.includes('cfc') || lower.includes('ur-pk') || lower.includes('ur_pk');
    });
    if (match) return match.identifier;
  }

  // 2. Language-filtered fallback with verified male/female tokens
  const langMatches = cachedVoices.filter((v) =>
    v.language.toLowerCase().startsWith(targetLang.toLowerCase())
  );

  if (langMatches.length === 0) return undefined;

  // Verified male tokens (strictly excluding 'iob')
  const maleKeywords = [
    'tpd',
    'iom',
    'rjs',
    'gbb',
    'gbd',
    'end',
    'ene',
    'male',
    'david',
    'daniel',
    'george',
    'oliver',
  ];
  const femaleKeywords = [
    'sfg',
    'tpf',
    'cfc',
    'iob',
    'female',
    'woman',
    'sarah',
    'fatima',
    'samantha',
    'zira',
  ];

  if (preset.gender === 'male') {
    const maleMatch = langMatches.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return maleKeywords.some((kw) => lower.includes(kw)) && !lower.includes('iob');
    });
    return maleMatch?.identifier;
  } else {
    const femaleMatch = langMatches.find((v) => {
      const lower = (v.identifier + ' ' + v.name).toLowerCase();
      return femaleKeywords.some((kw) => lower.includes(kw));
    });
    return (femaleMatch ?? langMatches[0]).identifier;
  }
}

/**
 * Speaks text using on-device expo-speech with zero perceived delay,
 * natural pitch values (strictly 0.94 - 1.06), and automatic script routing.
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

  // If text is pure Urdu script but user chose an English preset:
  // Route to Zara (deeper, slower Urdu) for male presets, or Fatima for female presets
  if (isUrdu && selectedPreset.language !== 'ur') {
    const matchingUrdu =
      selectedPreset.gender === 'male'
        ? TTS_VOICE_PRESETS.find((v) => v.id === 'ur-zara') ?? TTS_VOICE_PRESETS[0]
        : TTS_VOICE_PRESETS.find((v) => v.id === 'ur-fatima') ?? TTS_VOICE_PRESETS[0];
    targetPreset = matchingUrdu;
  }

  // Fast synchronous voice match from cached voices
  const matchedVoice = findMatchingVoiceIdentifier(targetPreset, targetPreset.language);

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
