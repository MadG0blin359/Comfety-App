---
name: verify-module
description: Audits a newly implemented Comfety module for 2-API free-tier rate-limit safety, Gemini 3.8 Flash compliance, banned heavy libraries, TypeScript strictness, and dual-modality accessibility invariants.
---

# Verify Comfety Module

Execute the following inspection steps on all files modified in the current phase:

1. **Architecture & Dependency Audit:**
   - Inspect `package.json` and imports to confirm zero usage of `langchain`, `@langchain/*`, vector databases, or Hugging Face cloud Inference APIs (`api-inference.huggingface.co`).
   - Confirm all Gemini calls use `"gemini-3.8-flash"` via `@google/genai`.

2. **Rate-Limit & Loop Audit:**
   - Inspect all `setInterval`, `setTimeout`, and camera frame processors.
   - Confirm Groq STT (`api.groq.com`) cannot fire faster than once every `4000ms` and is gated by RMS decibel metering.
   - Confirm Gemini structural obstacle checks cannot fire faster than once every `7000ms` (`<= 8.5 RPM`) and only run during accelerometer walking motion.
   - Verify `HTTP 429` exponential backoff and `AbortController` cleanup on unmount.

3. **Gemini 3.8 API Compliance Audit:**
   - Confirm absence of deprecated parameters (`temperature`, `top_p`, `top_k`) and prefilled `model` turns at the end of `contents`.
   - Verify `media_resolution` is `"low"` for 7-second obstacle checks and `"high"` for on-demand OCR/scene reading.

4. **Dual-Modality Accessibility & Hardware Safety Audit:**
   - **Entry Screen (`app/index.tsx`):** Verify zero small corner buttons or switches, automatic `expo-speech` onboarding on focus, `Speech.stop()` in cleanup/navigation, `delayLongPress={2000}`, and `Accelerometer` listener removal.
   - **Conversation Mode (`app/conversation.tsx`):** Verify `useAudioChunker` pauses during `expo-speech` playback, Urdu text sets `lineHeight >= fontSize * 1.6`, RMS meter updates live, and `"Show Large"` renders `40px` text.
   - **Guide Mode (`app/guide.tsx`):** Verify zero flashlight or speaker mute header buttons, automatic low-light torch activation, 2.5s auto-read fallback on single tap, and immediate `Speech.stop()` priority interrupts on hazard detection.

5. **Static Type Check & HITL Checklist:**
   - Run `npx tsc --noEmit` in the terminal and resolve all compiler errors.
   - Output a concise **HITL Physical Device Test Checklist** matching `USER_JOURNEYS.md` for human verification before advancing to the next phase.
