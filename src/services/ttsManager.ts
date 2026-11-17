import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TtsVoicePreset } from "../types";
import { STORAGE_KEYS } from "../constants/config";
import { isUrduScript } from "./groqStt";

export const TTS_VOICE_PRESETS: readonly TtsVoicePreset[] = [
  {
    id: "ur-fatima",
    name: "Fatima",
    language: "ur",
    pitch: 1.0,
    rate: 1.0,
    gender: "female",
    regionLabel: "Urdu (Warm Female)",
    samplePhrase: "السلام علیکم، میں آپ کی کیا مدد کر سکتی ہوں؟",
  },
  {
    id: "ur-tariq",
    name: "Tariq",
    language: "ur",
    pitch: 0.88,
    rate: 0.92,
    gender: "male",
    regionLabel: "Urdu (Deep Male)",
    samplePhrase: "السلام علیکم، میں آپ کا معاون ہوں۔",
  },
  {
    id: "en-sarah",
    name: "Sarah",
    language: "en",
    pitch: 1.0,
    rate: 1.0,
    gender: "female",
    regionLabel: "English (US Clear)",
    samplePhrase: "Hello, how can I help you today?",
  },
  {
    id: "en-david",
    name: "David",
    language: "en",
    pitch: 1.0,
    rate: 1.0,
    gender: "male",
    regionLabel: "English (US Deep)",
    samplePhrase: "Hello, I am ready to assist you.",
  },
  {
    id: "en-emma",
    name: "Emma",
    language: "en",
    pitch: 1.0,
    rate: 1.0,
    gender: "female",
    regionLabel: "English (UK Friendly)",
    samplePhrase: "Good day! Lovely to meet you.",
  },
  {
    id: "en-oliver",
    name: "Oliver",
    language: "en",
    pitch: 1.0,
    rate: 1.0,
    gender: "male",
    regionLabel: "English (UK Warm)",
    samplePhrase: "Hello there, hope you are having a pleasant day.",
  },
] as const;

export const DEFAULT_VOICE_ID = "ur-fatima";

let cachedVoices: Speech.Voice[] | null = null;
let activeUtteranceId = 0;

/**
 * Pre-warms and caches available native voices with Android cold-start warmup retry
 * and offline-first (-local / Enhanced) priority.
 */
export async function getAvailableNativeVoices(): Promise<Speech.Voice[]> {
  if (cachedVoices && cachedVoices.length > 0) {
    return cachedVoices;
  }
  try {
    let voices = await Speech.getAvailableVoicesAsync();

    // Cold-start warmup retry: Android TTS native service binder may still be connecting
    if (!voices || voices.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      voices = await Speech.getAvailableVoicesAsync();
    }

    // Prioritize offline-first local models and enhanced quality
    if (voices && voices.length > 0) {
      voices.sort((a, b) => {
        const aLocal = a.identifier.toLowerCase().includes("-local") ? 2 : 0;
        const bLocal = b.identifier.toLowerCase().includes("-local") ? 2 : 0;
        const aEnhanced =
          (a.quality ?? "").toLowerCase() === "enhanced" ? 1 : 0;
        const bEnhanced =
          (b.quality ?? "").toLowerCase() === "enhanced" ? 1 : 0;
        return bLocal + bEnhanced - (aLocal + aEnhanced);
      });
    }

    cachedVoices = voices ?? [];
    return cachedVoices;
  } catch (err) {
    console.warn("[TTSManager] Failed to query native voices:", err);
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
    console.warn(
      "[TTSManager] Failed to load selected voice from storage:",
      err,
    );
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
    console.error("[TTSManager] Failed to persist selected voice:", err);
  }
}

export interface SpeakOptions {
  voiceId?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Synchronous voice matching from pre-cached system voices prioritizing Google's
 * premade human-trained neural voice models (tpd, sfg, rjs, fis, cfc).
 */
function findMatchingVoiceIdentifier(
  targetLang: string,
  targetGender: "female" | "male",
  presetId?: string,
): string | undefined {
  if (!cachedVoices || cachedVoices.length === 0) return undefined;

  const langMatches = cachedVoices.filter((v) =>
    v.language.toLowerCase().startsWith(targetLang.toLowerCase()),
  );

  if (langMatches.length === 0) return undefined;

  // Regional prioritization: ensure UK presets (Oliver, Emma) prioritize British voices
  // and US presets (David, Sarah) prioritize US voices if regional variants exist
  let orderedMatches = langMatches;
  if (presetId === "en-oliver" || presetId === "en-emma") {
    orderedMatches = [...langMatches].sort((a, b) => {
      const aUk = /(gb|uk|british)/i.test(a.identifier + " " + a.name) ? 1 : 0;
      const bUk = /(gb|uk|british)/i.test(b.identifier + " " + b.name) ? 1 : 0;
      return bUk - aUk;
    });
  } else if (presetId === "en-david" || presetId === "en-sarah") {
    orderedMatches = [...langMatches].sort((a, b) => {
      const aUs = /(us|american)/i.test(a.identifier + " " + a.name) ? 1 : 0;
      const bUs = /(us|american)/i.test(b.identifier + " " + b.name) ? 1 : 0;
      return bUs - aUs;
    });
  }

  // Direct mapping to Google's premade neural voice identifiers on Android
  const PREMADE_NEURAL_TAGS: Record<string, string[]> = {
    "en-david": ["tpd", "david", "male", "iom"], // US Male (human-recorded)
    "en-sarah": ["sfg", "sarah", "female", "samantha"], // US Female (human-recorded)
    "en-oliver": ["rjs", "oliver", "male", "george"], // UK Male (human-recorded)
    "en-emma": ["fis", "emma", "female", "victoria"], // UK Female (human-recorded)
    "ur-fatima": ["cfc", "fatima", "female"], // Urdu Female (human-recorded)
    "ur-tariq": ["cfc", "tariq", "male"], // Urdu (Google ships cfc for Urdu)
  };

  if (presetId && PREMADE_NEURAL_TAGS[presetId]) {
    const tags = PREMADE_NEURAL_TAGS[presetId];
    for (const tag of tags) {
      const match = orderedMatches.find((v) => {
        const idLower = (v.identifier + " " + v.name).toLowerCase();
        return idLower.includes(tag);
      });
      if (match) return match.identifier;
    }
  }

  const maleKeywords = [
    "male",
    "man",
    "boy",
    "david",
    "daniel",
    "george",
    "oliver",
    "tariq",
    "tpd",
    "iom",
    "iob",
    "rjs",
  ];
  const femaleKeywords = [
    "female",
    "woman",
    "girl",
    "lady",
    "fatima",
    "samantha",
    "sarah",
    "zira",
    "sfg",
    "fis",
    "cfc",
  ];

  if (targetGender === "male") {
    const maleMatch = orderedMatches.find((v) => {
      const lower = (v.name + " " + v.identifier).toLowerCase();
      return maleKeywords.some((kw) => lower.includes(kw));
    });
    return maleMatch?.identifier;
  } else {
    const femaleMatch = orderedMatches.find((v) => {
      const lower = (v.name + " " + v.identifier).toLowerCase();
      return femaleKeywords.some((kw) => lower.includes(kw));
    });
    return (femaleMatch ?? orderedMatches[0]).identifier;
  }
}

const MAX_SPEECH_CHUNK_LENGTH = 3500;

/**
 * Splits lengthy text along sentence boundaries so it never exceeds
 * Android's 4,000-character utterance ceiling (Speech.maxSpeechInputLength).
 */
export function splitTextIntoSpeechChunks(text: string): string[] {
  if (text.length <= MAX_SPEECH_CHUNK_LENGTH) {
    return [text];
  }

  const sentenceRegex = /([^۔.!?\n]+[۔.!?\n]*)/g;
  const sentences = text.match(sentenceRegex) ?? [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_SPEECH_CHUNK_LENGTH) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Speaks text using on-device expo-speech with zero perceived delay,
 * automatic Urdu/English script routing, sentence chunking for long texts,
 * and robust utterance-ID protected echo-prevention lifecycle callbacks.
 */
export async function speakText(
  text: string,
  options: SpeakOptions = {},
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Pre-load native voices if not already cached (handles cold start before first speak)
  if (!cachedVoices || cachedVoices.length === 0) {
    await getAvailableNativeVoices();
  }

  // Monotonic utterance ID to prevent race conditions from canceled utterances
  const utteranceId = ++activeUtteranceId;

  // Await Speech.stop() to ensure native queue is flushed before new utterance starts
  try {
    await Speech.stop();
  } catch (err) {
    console.warn("[TTSManager] Speech.stop error:", err);
  }

  // If another utterance started while waiting for Speech.stop(), abort this one
  if (utteranceId !== activeUtteranceId) {
    return;
  }

  const isUrdu = isUrduScript(trimmed);

  // Find requested preset
  const selectedPreset =
    TTS_VOICE_PRESETS.find((v) => v.id === options.voiceId) ??
    TTS_VOICE_PRESETS[0];

  let targetPreset = selectedPreset;

  // If text is Urdu script but user chose an English preset, map to the corresponding gender-matched Urdu preset
  if (isUrdu && selectedPreset.language !== "ur") {
    const matchingUrdu =
      TTS_VOICE_PRESETS.find(
        (v) => v.language === "ur" && v.gender === selectedPreset.gender,
      ) ?? TTS_VOICE_PRESETS[0];
    targetPreset = matchingUrdu;
  }

  // Fast synchronous voice match prioritizing Google premade neural models
  const matchedVoice = findMatchingVoiceIdentifier(
    targetPreset.language,
    targetPreset.gender,
    targetPreset.id,
  );

  // Trigger onStart before speech begins (invoking echo-gating pause on microphone)
  options.onStart?.();

  // Split into sentence chunks if text exceeds Android's 4,000 character limit
  const chunks = splitTextIntoSpeechChunks(trimmed);
  let chunkIndex = 0;

  const handleFinish = () => {
    if (utteranceId === activeUtteranceId) {
      options.onDone?.();
    }
  };

  const speakNextChunk = () => {
    if (utteranceId !== activeUtteranceId) {
      return;
    }

    if (chunkIndex >= chunks.length) {
      handleFinish();
      return;
    }

    const currentChunkText = chunks[chunkIndex++];
    const isFinalChunk = chunkIndex >= chunks.length;

    try {
      Speech.speak(currentChunkText, {
        language: targetPreset.language, // 'ur' or 'en'
        pitch: targetPreset.pitch,
        rate: targetPreset.rate,
        volume: 1.0,
        voice: matchedVoice,
        onDone: () => {
          if (utteranceId !== activeUtteranceId) return;
          if (isFinalChunk) {
            handleFinish();
          } else {
            speakNextChunk();
          }
        },
        onStopped: () => {
          // If a newer utterance started, do NOT trigger completion
          if (utteranceId === activeUtteranceId) {
            handleFinish();
          }
        },
        onError: (err) => {
          if (utteranceId !== activeUtteranceId) return;
          console.warn("[TTSManager] Speech synthesis error:", err);
          options.onError?.(new Error(String(err)));
          handleFinish();
        },
      });
    } catch (speakErr) {
      if (utteranceId !== activeUtteranceId) return;
      console.error("[TTSManager] Failed to invoke Speech.speak:", speakErr);
      options.onError?.(
        speakErr instanceof Error ? speakErr : new Error(String(speakErr)),
      );
      handleFinish();
    }
  };

  speakNextChunk();
}

/**
 * Immediately halts active speech synthesis.
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (err) {
    console.warn("[TTSManager] Failed to stop speech:", err);
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
