import { GoogleGenAI } from '@google/genai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV_CONFIG, AI_MODELS, STORAGE_KEYS, APP_CONFIG } from '../constants/config';
import {
  VisionDescriptionResult,
  VisionRequestOptions,
  UserAccessibilityContext,
} from '../types';

let genAIClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    if (!ENV_CONFIG.GEMINI_API_KEY.trim()) {
      throw new Error(
        'Gemini API Key is not configured. Please set EXPO_PUBLIC_GEMINI_API_KEY in your environment.'
      );
    }
    genAIClient = new GoogleGenAI({ apiKey: ENV_CONFIG.GEMINI_API_KEY });
  }
  return genAIClient;
}

const BASE_VISION_SYSTEM_INSTRUCTION = `You are Comfety Vision AI, an assistive visual interpreter designed for blind and visually impaired individuals in Pakistan.
Your mission is to provide concise, spatial, and high-utility descriptions of the user's immediate environment and read printed materials accurately.

Core Directives:
1. Priority for Printed Text: If medicine boxes, prescription labels, expiration dates, utility bills, street signs, prices, or notices are present, read the most critical information FIRST (e.g. medicine brand name, dosage, expiry date, payable amount, due date, street name).
2. Concise & Spatial: Use direct, natural language with clear spatial references (e.g. "Directly in front of you", "On your left", "Approximately 1 meter ahead"). Keep general scene descriptions under 3-4 sentences.
3. Plain Language: Avoid complex medical jargon or academic terminology. Speak warmly, respectfully, and clearly so it sounds natural when vocalized via Text-to-Speech.
4. Bilingual Awareness: You understand both English and Urdu contexts in Pakistan. If printed text is in Urdu Nastaliq or English, read it in its natural language.
5. Honesty: If text is blurry, cut off, or illegible, state clearly: "The text is too blurry to read clearly. Please hold the phone steady or move slightly closer."`;

async function getEnrichedSystemInstruction(): Promise<string> {
  try {
    const userContextJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_CONTEXT);
    if (userContextJson) {
      const userContext: UserAccessibilityContext = JSON.parse(userContextJson);
      let extra = '\n\nUser Profile & Accessibility Context:';
      if (userContext.explanationLevel === 'simple') {
        extra += '\n- The user has requested all explanations be kept in ultra-simple, 5th-grade words.';
      }
      if (userContext.emergencyNotes) {
        extra += `\n- User medical/accessibility notes: ${userContext.emergencyNotes}`;
      }
      return BASE_VISION_SYSTEM_INSTRUCTION + extra;
    }
  } catch (err) {
    console.warn('[GeminiVision] Failed to read user context:', err);
  }
  return BASE_VISION_SYSTEM_INSTRUCTION;
}

interface InternalTurn {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

let inMemoryTurns: InternalTurn[] = [];
const MAX_TURNS = 6; // Keep last 3 exchanges (3 user, 3 model) to conserve context & latency

export function resetVisionConversation(): void {
  inMemoryTurns = [];
}

/**
 * Checks if an error is an HTTP 429 rate limit error or quota exhaustion.
 */
function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = String(err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted')
  );
}

/**
 * Analyzes a captured camera frame with Gemini 3.8 Flash for OCR and scene description.
 * Implements exponential backoff and fast fallback to gemini-3.5-flash-lite on 429.
 */
export async function describeSceneOrReadText(
  base64Jpeg: string,
  options: VisionRequestOptions = {}
): Promise<VisionDescriptionResult> {
  const ai = getGenAIClient();
  const systemInstruction = await getEnrichedSystemInstruction();

  const userPrompt =
    options.userSpokenQuestion?.trim() ||
    options.customPrompt?.trim() ||
    'Describe this scene concisely for a blind person. If there is printed text, medicine labels, signs, or bills, read the most critical information first (names, dates, warnings, amounts).';

  // Construct fresh user turn with image and text
  const currentTurn: InternalTurn = {
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Jpeg,
        },
      },
      { text: userPrompt },
    ],
  };

  // Ensure invariants: final entry in contents must always have role: "user"
  const contentsToSend = [...inMemoryTurns, currentTurn];

  const retryDelays = APP_CONFIG.gemini.visionRateLimit.retryBackoffMs;
  let activeModel: string = AI_MODELS.VISION_PRIMARY_MODEL;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (options.signal?.aborted) {
      const abortErr = new Error('Vision request aborted by user.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      const response = await ai.models.generateContent({
        model: activeModel,
        contents: contentsToSend as any,
        config: {
          systemInstruction,
          abortSignal: options.signal,
        },
      });

      const rawText = response.text?.trim() ?? '';
      if (!rawText) {
        throw new Error('No description returned by Gemini Vision.');
      }

      // Record successful exchange in memory (pruning oldest turns if exceeding limit)
      inMemoryTurns.push(currentTurn);
      inMemoryTurns.push({
        role: 'model',
        parts: [{ text: rawText }],
      });
      if (inMemoryTurns.length > MAX_TURNS) {
        inMemoryTurns = inMemoryTurns.slice(inMemoryTurns.length - MAX_TURNS);
      }

      const hasTextReading =
        /label|bill|prescription|expiry|mg|tablet|capsule|amount|date|sign|rupee|rs/i.test(
          rawText
        );

      return {
        text: rawText,
        modelUsed: activeModel,
        hasTextReading,
        isSimplified: false,
      };
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        const abortErr = new Error('Vision request aborted.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (isRateLimitError(err)) {
        // Switch to fast fallback model on rate limit
        if (activeModel === AI_MODELS.VISION_PRIMARY_MODEL) {
          console.warn(
            `[GeminiVision] Primary model ${AI_MODELS.VISION_PRIMARY_MODEL} rate limited. Switching to fast fallback ${AI_MODELS.VISION_FAST_FALLBACK_MODEL}...`
          );
          activeModel = AI_MODELS.VISION_FAST_FALLBACK_MODEL;
        }

        if (attempt < retryDelays.length) {
          const delay = retryDelays[attempt];
          console.warn(`[GeminiVision] 429 received, backing off for ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      if (attempt < retryDelays.length && !options.signal?.aborted) {
        const delay = retryDelays[attempt];
        console.warn(`[GeminiVision] Error on attempt ${attempt + 1}: ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError ?? new Error('Gemini Vision analysis failed.');
}

/**
 * Simplifies the last visual response into plain, everyday language using multi-turn memory.
 */
export async function simplifyLastResponse(
  options: VisionRequestOptions = {}
): Promise<VisionDescriptionResult> {
  if (inMemoryTurns.length === 0) {
    return {
      text: 'There is no previous description to simplify. Please tap the screen once to look at something first.',
      modelUsed: AI_MODELS.VISION_PRIMARY_MODEL,
      hasTextReading: false,
      isSimplified: true,
    };
  }

  const ai = getGenAIClient();
  const systemInstruction = await getEnrichedSystemInstruction();

  const simplifyPrompt =
    'Explain your previous response in much simpler, everyday words using short sentences. Avoid medical and technical jargon completely so it is crystal clear.';

  const simplificationTurn: InternalTurn = {
    role: 'user',
    parts: [{ text: simplifyPrompt }],
  };

  const contentsToSend = [...inMemoryTurns, simplificationTurn];
  let activeModel: string = AI_MODELS.VISION_PRIMARY_MODEL;

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: contentsToSend as any,
      config: {
        systemInstruction,
        abortSignal: options.signal,
      },
    });

    const simplifiedText = response.text?.trim() ?? '';
    if (!simplifiedText) {
      throw new Error('Gemini returned an empty simplification.');
    }

    inMemoryTurns.push(simplificationTurn);
    inMemoryTurns.push({
      role: 'model',
      parts: [{ text: simplifiedText }],
    });
    if (inMemoryTurns.length > MAX_TURNS) {
      inMemoryTurns = inMemoryTurns.slice(inMemoryTurns.length - MAX_TURNS);
    }

    return {
      text: simplifiedText,
      modelUsed: activeModel,
      hasTextReading: false,
      isSimplified: true,
    };
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      console.warn('[GeminiVision] Simplification rate limited on primary model. Retrying with fallback...');
      const fallbackResponse = await ai.models.generateContent({
        model: AI_MODELS.VISION_FAST_FALLBACK_MODEL,
        contents: contentsToSend as any,
        config: {
          systemInstruction,
          abortSignal: options.signal,
        },
      });
      return {
        text: fallbackResponse.text?.trim() ?? 'Unable to simplify at this moment.',
        modelUsed: AI_MODELS.VISION_FAST_FALLBACK_MODEL,
        hasTextReading: false,
        isSimplified: true,
      };
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}
