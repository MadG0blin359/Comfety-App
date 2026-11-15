import { APP_CONFIG, RATE_LIMITS, ENV_CONFIG } from '../constants/config';
import { TranscriptionResult } from '../types';

let lastGroqRequestTimestamp = 0;

/**
 * Checks whether text contains Urdu or Arabic script characters.
 */
export function isUrduScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
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
}

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

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'audio.m4a',
  } as unknown as Blob);

  formData.append('model', APP_CONFIG.groq.model);
  formData.append('prompt', APP_CONFIG.groq.prompt);
  formData.append('response_format', 'json');
  formData.append('temperature', '0.0');

  const backoffDelays = APP_CONFIG.groq.rateLimit.retryBackoffMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffDelays.length; attempt++) {
    if (options?.signal?.aborted) {
      throw new Error('Transcription aborted by user or screen navigation.');
    }

    try {
      const response = await fetch(APP_CONFIG.groq.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV_CONFIG.GROQ_API_KEY}`,
        },
        body: formData,
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

      const json = (await response.json()) as { text?: string; duration?: number; language?: string };
      const rawText = json.text?.trim() ?? '';

      return {
        text: rawText,
        duration: json.duration,
        language: json.language,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Transcription aborted.');
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
