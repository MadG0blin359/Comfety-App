import { APP_CONFIG, RATE_LIMITS, ENV_CONFIG } from '../constants/config';
import { TranscriptionResult } from '../types';
import { devanagariToUrdu, hasDevanagari } from '../utils/devanagariToUrdu';

let lastGroqRequestTimestamp = 0;

/**
 * Checks whether text contains Urdu or Arabic script characters.
 */
export function isUrduScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Checks whether text contains any Hindi Devanagari script characters (\u0900-\u097F).
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Checks if an error represents a normal fetch abortion or user cancellation.
 */
export function isAbortOrCancelError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();
    return (
      name === 'aborterror' ||
      name === 'cancelederror' ||
      msg.includes('canceled') ||
      msg.includes('cancelled') ||
      msg.includes('aborted') ||
      msg.includes('abort')
    );
  }
  return false;
}

/**
 * Detects known Whisper Large v3 silence/noise hallucination artifacts.
 */
export function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Urdu & English music, noise, applause, silence tokens
  if (/^(\[|\()? *(music|موسیقی|applause|laughter|silence|sound|noise) *(\]|\))?$/i.test(trimmed)) {
    return true;
  }

  // Musical notes or punctuation/whitespace-only strings
  if (/^[♪♫🎵♩\.\,\?\!\:\;\-\_\s]+$/.test(trimmed)) {
    return true;
  }

  // Common subtitle credit hallucinations on empty audio
  if (/^(subtitles?|amara\.org|opensubtitles|translated by|captioned by)/i.test(trimmed)) {
    return true;
  }

  // Repeated single characters like "..." or "---"
  if (/^(.)\1{3,}$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Ensures strict minimum interval between consecutive Groq requests
 * to stay safely within free-tier quota ceiling (max 15 RPM, ceiling 20 RPM).
 */
async function enforceRateLimitInterval(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastGroqRequestTimestamp;
  const waitTime = RATE_LIMITS.GROQ_MIN_INTERVAL_MS - elapsed;

  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastGroqRequestTimestamp = Date.now();
}

export interface TranscribeOptions {
  signal?: AbortSignal;
  isRetryWithUrdu?: boolean;
}

export interface WhisperSegment {
  id?: number;
  seek?: number;
  start?: number;
  end?: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

export interface GroqVerboseResponse {
  task?: string;
  language?: string;
  duration?: number;
  text?: string;
  segments?: WhisperSegment[];
}

export const HALLUCINATION_BLOCKLIST = new Set<string>([
  'موسیقی',
  'music',
  'شکریہ',
  'سبسکرائب',
  'اردو اور انگریزی گفتگو',
  'bilingual urdu and english speech',
  'سلام علیکم',
  'السلام علیکم',
  'یہ کتنے کا ہے؟',
  'اوٹھ با ملوم سلام علیکم',
]);

/**
 * Transcribes audio via Groq Whisper Large v3 Turbo REST endpoint.
 * Features prompt conditioning for Pakistani code-switching and Urdu Nastaliq script preservation.
 */
export async function transcribeAudio(
  audioUri: string,
  options?: TranscribeOptions
): Promise<TranscriptionResult> {
  if (!ENV_CONFIG.GROQ_API_KEY.trim()) {
    throw new Error('Groq API Key is not configured. Please set EXPO_PUBLIC_GROQ_API_KEY.');
  }

  await enforceRateLimitInterval();

  // Read recorded audio chunk into bytes for Expo WinterCG-compliant fetch FormData
  let bytes: Uint8Array;
  try {
    const fileRes = await fetch(audioUri);
    if (!fileRes.ok) {
      throw new Error(`Failed to read audio file (${fileRes.status}): ${fileRes.statusText}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);
  } catch (readErr) {
    throw new Error(
      `Unable to read recorded audio chunk: ${
        readErr instanceof Error ? readErr.message : String(readErr)
      }`
    );
  }

  // If audio chunk is completely empty, skip API call to save quota
  if (bytes.byteLength === 0) {
    return { text: '' };
  }

  // Helper to build fresh FormData instance with byte-streamable part for each attempt
  const buildFormData = (forcedLanguage?: string): FormData => {
    const formData = new FormData();
    const audioPart = {
      name: 'audio.m4a',
      type: 'audio/m4a',
      bytes: () => bytes,
    };

    formData.append('file', audioPart as unknown as Blob);
    formData.append('model', APP_CONFIG.groq.model);
    formData.append('prompt', APP_CONFIG.groq.prompt);
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');
    if (forcedLanguage) {
      formData.append('language', forcedLanguage);
    }
    return formData;
  };

  const backoffDelays = APP_CONFIG.groq.rateLimit.retryBackoffMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffDelays.length; attempt++) {
    if (options?.signal?.aborted) {
      const abortErr = new Error('Transcription aborted by user or screen navigation.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      const response = await fetch(APP_CONFIG.groq.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV_CONFIG.GROQ_API_KEY}`,
        },
        body: buildFormData(),
        signal: options?.signal,
      });

      if (response.status === 429) {
        if (attempt < backoffDelays.length) {
          const delay = backoffDelays[attempt];
          console.warn(`[GroqSTT] Rate limited (HTTP 429). Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error('Groq STT rate limit exceeded (HTTP 429). Maximum retries exhausted.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq STT API Error (${response.status}): ${errorText}`);
      }

      const json = (await response.json()) as GroqVerboseResponse;
      const rawText = json.text?.trim() ?? '';

      // Layer 2 Safeguard: Discard chunk if Whisper's internal confidence flags it as silence
      if (json.segments && json.segments.length > 0) {
        const isHallucinatedSilence = json.segments.every(
          (seg) => (seg.no_speech_prob ?? 0) > 0.6 || (seg.avg_logprob ?? 0) < -1.0
        );
        if (isHallucinatedSilence) {
          console.log(
            '[GroqSTT] Discarded silent chunk (no_speech_prob > 0.6 or avg_logprob < -1.0):',
            rawText
          );
          return {
            text: '',
            duration: json.duration,
            language: json.language,
          };
        }
      }

      // Layer 3 Safeguard: Block known silence/prompt artifacts
      const cleaned = rawText
        .trim()
        .replace(/[.,!?؟؛:۔\-_\s]+$/g, '')
        .toLowerCase();

      if (!cleaned || HALLUCINATION_BLOCKLIST.has(cleaned) || isWhisperHallucination(rawText)) {
        if (cleaned) {
          console.log('[GroqSTT] Filtered known hallucination artifact:', rawText);
        }
        return {
          text: '',
          duration: json.duration,
          language: json.language,
        };
      }

      // Layer 4 Safeguard: Zero-Dependency Instant Devanagari-to-Urdu Transliteration
      // If Whisper misidentifies Pakistani speech as Hindi or generates Devanagari script,
      // instantly map Devanagari to authentic Urdu Nastaliq orthography (< 1ms on Hermes, 0 API calls).
      let finalText = rawText;
      if (hasDevanagari(finalText) || json.language?.toLowerCase() === 'hindi') {
        console.log(`[GroqSTT] Converting Devanagari to Urdu Nastaliq script: "${finalText}"`);
        finalText = devanagariToUrdu(finalText);
      }

      // Hard Devanagari exclusion safeguard: ensure zero Hindi characters ever leak into transcript
      if (hasDevanagari(finalText)) {
        finalText = finalText.replace(/[\u0900-\u097F]+/g, '').trim();
      }

      return {
        text: finalText,
        duration: json.duration,
        language: isUrduScript(finalText) ? 'urdu' : json.language,
      };
    } catch (err: unknown) {
      if (isAbortOrCancelError(err) || options?.signal?.aborted) {
        const abortErr = new Error('Transcription aborted.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < backoffDelays.length && !options?.signal?.aborted) {
        const delay = backoffDelays[attempt];
        console.warn(`[GroqSTT] Request error, retrying in ${delay}ms:`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError ?? new Error('Transcription failed with unknown error.');
}
