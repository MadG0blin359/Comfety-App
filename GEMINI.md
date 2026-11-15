# Project: Comfety — Assistive Mobile Application (React Native / Expo)

## 1. Mission & Core Architecture

Comfety is a standalone React Native (Expo + TypeScript) accessibility mobile application requiring zero external backend servers:

- **Part A — Conversation Mode (Deaf / Mute / Speech-Impaired):** Continuous live bilingual transcription (Urdu, English, and mixed Urdu-English code-switching in noisy environments such as bazaars, clinics, and banks), natural Text-to-Speech (TTS) with at least 4 selectable voices, customizable quick-reply phrases, and a full-screen `40px` counter display card.
- **Part B — Guide Mode (Blind / Low-Vision):** Conversational voice assistant capable of explaining information in simpler words upon user confusion, on-demand rear-camera scene description and text reading (medicine labels, signs, bills), and proactive audio/haptic obstacle warnings (stairs, open drains, vehicles, people).

Read the `EXPECTED_USER_FLOW.md` D:\Desktop Folders\Run Codes\Comfety-App\EXPECTED_USER_FLOW.md for detailed expected user flow.

## 2. Consolidated Free-Tier & On-Device AI Stack (Zero-Backend)

All intelligence runs directly from the mobile client using two free-tier cloud endpoints and two local on-device engines, governed by `src/constants/config.ts`:

1. **Bilingual Speech-to-Text (`src/services/groqStt.ts` & `src/hooks/useAudioChunker.ts`):**
   - **Audio Capture Library:** Use **`expo-audio`** (`useAudioRecorder` with `{ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }`, `useAudioRecorderState`, `AudioModule.requestRecordingPermissionsAsync`, and `setAudioModeAsync`). **Never** import or install `expo-av`.
   - **Model:** `whisper-large-v3-turbo` (`AI_MODELS.STT_MODEL`) via Groq REST API (`https://api.groq.com/openai/v1/audio/transcriptions`).
   - **Quota Ceiling:** 20 RPM / 2,000 RPD / 7,200 audio seconds per hour.
   - **Enforcement:** Gate audio uploads using `expo-audio` metering levels so silent intervals are discarded locally. Never exceed 1 upload every `4,000ms` (`RATE_LIMITS.GROQ_MIN_INTERVAL_MS`). Always pass `prompt: "Urdu and English mixed conversation. السلام علیکم، یہ کتنے کا ہے؟"` in multipart requests to preserve Urdu Nastaliq script and prevent Hindi Devanagari transliteration.

2. **Natural Text-to-Speech (`src/services/ttsManager.ts`):**
   - **Engine:** On-device `expo-speech` (0 external API calls, unlimited quota).
   - **Enforcement:** Expose at least 6 distinct voice presets mapped to available OS neural voices across English and Urdu locales with distinct pitch and rate parameters.

3. **Vision, OCR, Simplification & Structural Hazards (`src/services/geminiVision.ts`):**
   - **Primary Model:** `gemini-3.8-flash` (`AI_MODELS.VISION_PRIMARY_MODEL`) via `@google/genai`.
   - **Fast Fallback Model:** `gemini-3.5-flash-lite` (`AI_MODELS.VISION_FAST_FALLBACK_MODEL`). Automatically route 7-second structural hazard checks to `gemini-3.5-flash-lite` if `gemini-3.8-flash` returns `HTTP 429` or approaches RPM limits.
   - **Dual-Resolution Routing:**
     - _On-Demand Reading & Simplification (`media_resolution: "high"`):_ Triggered exclusively by user gesture or voice command (reading medicine labels, bills, signs, or re-explaining previous responses in simpler words). Retains in-memory multi-turn `Content[]` history.
     - _Throttled Structural Hazard Check (`media_resolution: "low"`):_ Strictly rate-limited to **at most 1 request every `7,000ms`** (`RATE_LIMITS.GEMINI_HAZARD_INTERVAL_MS`, `<= 8.5 RPM`) and active only when `expo-sensors` Accelerometer detects walking motion. Inspects compressed `512x384` JPEG frames specifically for **stairs** and **open drains**.
   - **Local Context Injection (Replaces Vector RAG):** Load user preferences and saved accessibility context from `AsyncStorage` key `comfety_user_context` and inject them directly into `systemInstruction`.

4. **Real-Time Local Obstacle Detection (`src/hooks/useObstacleLoop.ts`):**
   - **Engine:** `react-native-fast-tflite` running the official Google quantized COCO `efficientdet-lite0` model (`assets/models/efficientdet-lite0.tflite`) at `>= 10 FPS` with `0` network calls.
   - **Input & Target Classes:** Resize camera frames via `vision-camera-resize-plugin` to `320x320` RGB (`uint8`, `0–255`). Require `>= 0.55` confidence across 2 consecutive frames before triggering immediate priority warnings for COCO classes: `person` (`0`), `bicycle` (`1`), `car` (`2`), `motorcycle` (`3`), `bus` (`5`), and `truck` (`7`).

5. **Explicit Architectural & Build Exclusions:**
   - Do **NOT** install or import `expo-av` (deprecated in Expo SDK 58; throws native JSI `UnsatisfiedLinkError`). Always use `expo-audio` + `expo-asset`.
   - Do **NOT** install or import `langchain`, `@langchain/*`, vector database SDKs, embedding models, or Hugging Face cloud Inference APIs (`api-inference.huggingface.co`).
   - Do **NOT** scaffold a separate Node.js/Express/Python backend server.
   - Maintain `minSdkVersion: 26` and `buildArchs: ["arm64-v8a"]` in `app.json` via `expo-build-properties`, and register `'tflite'` in `metro.config.js` (`config.resolver.assetExts.push('tflite')`).

## 3. Gemini 3.8 Flash API Compatibility Rules

When writing code in `src/services/geminiVision.ts`:

- Use the official `@google/genai` TypeScript SDK with model identifiers from `AI_MODELS` (`"gemini-3.8-flash"` and `"gemini-3.5-flash-lite"`).
- **NEVER** pass deprecated sampling parameters (`temperature`, `top_p`, `top_k`).
- **NEVER** end a `contents` array with a prefilled `model` turn; the final entry must always have `role: "user"`.
- Implement exponential backoff retry logic (`2s`, `4s`, `8s`) on `HTTP 429` responses and `AbortController` cancellation on screen blur/unmount.

## 4. ADLC + HITL Execution Protocol

- **Reference Documentation:** Always consult `IMPLEMENTATION_PLAN.md`, `USER_JOURNEYS.md`, `docs/design/DESIGN.md`, and `docs/design/screens/` before generating UI or service modules.
- **Planning Gate:** Always generate an Implementation Plan artifact before creating or modifying source files. Wait for explicit human approval before executing code edits.
- **Incremental Vertical Slices:** Build and verify one isolated module at a time. Never generate multiple unrelated screens or services in a single turn.
- **Strict Type Safety:** Zero `any` types, zero silent `catch {}` blocks, and descriptive error states surfaced to the user via audio (Part B) or high-contrast banners (Part A).

## 5. Dual-Modality Entry, Accessibility & UX Standards

### A. Launch Screen Dual-Modality Invariants (`app/index.tsx`)

1. **Zero Small Buttons on Launch:** Do **NOT** render a top-right speaker icon, small toggle switch, or any small corner buttons on the home screen.
2. **Automatic Spoken Onboarding:** Upon screen focus (when auto-open is disabled), immediately invoke `expo-speech` to announce:
   _"Welcome to Comfety. Tap the top half for Conversation Mode. Tap the bottom half, hold anywhere for two seconds, or shake the phone to start Guide Mode."_
   Always call `Speech.stop()` before navigating so onboarding audio never overlaps destination prompts.
3. **Zero-Precision 50/50 Touch Zones:** Divide the primary viewport into two equal full-width touch surfaces (`flex: 1`) matching the visual mode cards—top half launches `/conversation`, bottom half launches `/guide`.
4. **No-Look Blind Entry Triggers:**
   - Bind `delayLongPress={2000}` and `onLongPress` to both full-screen halves so holding anywhere on the screen for 2 seconds launches `/guide`.
   - Monitor `expo-sensors` Accelerometer (`150ms` interval); if two acceleration spikes (`> 2.1g`) occur within `1000ms`, launch `/guide` hands-free. Unsubscribe on screen blur.
   - Trigger `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on `onPressIn` and `Haptics.notificationAsync(NotificationFeedbackType.Success)` upon mode selection.
5. **Native Screen Reader & Persistent Mode Memory:** Define `accessible={true}`, `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityHint` on both mode cards. Persist `comfety_preferred_mode` and `comfety_auto_open` in `AsyncStorage`, supporting `/?select=true` bypass when switching modes.

### B. Mode-Specific UX Standards

- **Part A (`app/conversation.tsx`):** Minimum `20px` high-contrast transcript font, `lineHeight >= fontSize * 1.6` for all Urdu Nastaliq text, auto-scrolling dialogue log, single-tap `Speak` execution, visible `+ Save Phrase` custom phrase trigger, and minimum `48x48dp` touch targets.
- **Part B (`app/guide.tsx`):** Never display `"LiDAR"` terminology in UI copy; use `"Vision AI Active"`. Bind full-screen gestures uniformly across the viewport (`1x Tap: Ask or Auto-Read`, `2x Tap: Simplify`, `Long Press 1.5s: Toggle Alerts`) with `expo-haptics` feedback.

### C. Simplified Hardware & Sensory Safeguards

1. **Zero Small Header Controls in Guide Mode:** Do **NOT** render flashlight buttons, speaker mute icons, or separate `"More Details"` buttons in `app/guide.tsx`. Manage the camera torch (`torch="on"`) automatically when frame luminance is low during text reading, or via spoken voice command (_"Turn on light"_).
2. **Smart Single-Tap Auto-Read Fallback:** On `1x Tap` in Guide Mode, stop active TTS, emit a haptic tick, and listen for `2500ms` for a spoken question; if no speech is detected within `2500ms`, automatically capture the frame and read/describe what is in front of the camera.
3. **Priority Obstacle Interrupts:** Any detected hazard (`stairs`, `open drain`, `vehicle`, `person`) must immediately invoke `Speech.stop()`, trigger `Haptics.notificationAsync(NotificationFeedbackType.Error)`, and speak a concise warning (`<= 5 words`) before resuming any other audio.
4. **TTS-to-STT Echo Prevention:** Pause `useAudioChunker` recording before starting `expo-speech` playback in Conversation Mode and resume `300ms` after `onDone` / `onError`.
5. **Deaf Accessibility Enhancements:** Render a real-time microphone RMS decibel meter bar in Conversation Mode and provide a full-screen `"Show Large"` (`40px` high-contrast text) modal on user replies for noisy environments.
