# Comfety — Standalone Assistive Mobile Application

<div align="center">

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2058.0.25-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.88.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%206.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Google%20Gen%20AI-Gemini%203.8%20Flash-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://aistudio.google.com)
[![Groq](https://img.shields.io/badge/Groq%20Cloud-Whisper%20Large%20v3%20Turbo-F55036?style=for-the-badge)](https://groq.com)
[![TFLite](https://img.shields.io/badge/On--Device-TFLite%20EfficientDet--Lite0-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![Zero Backend](https://img.shields.io/badge/Architecture-100%25%20Zero--Backend-success?style=for-the-badge)](https://github.com)

<p align="center">
  <b>Comfety</b> is a production-grade, zero-backend assistive mobile application built with React Native (Expo SDK 58) and TypeScript. Engineered specifically for individuals with sensory and speech disabilities in low-resource, noisy environments such as Pakistani bazaars, clinics, banks, and public transit hubs.
</p>

</div>

---

## Table of Contents

- [1. Assistive Mission & Vision](#1-assistive-mission--vision)
- [2. Dual-Modality Architecture](#2-dual-modality-architecture)
  - [Persona-to-Mode Mapping](#persona-to-mode-mapping)
  - [Zero-Precision Launch Screen](#zero-precision-launch-screen-appindextsx)
  - [Part A — Conversation Mode (Deaf / Mute / Speech-Impaired)](#part-a--conversation-mode-appconversationtsx)
  - [Part B — Guide Mode (Blind / Low-Vision)](#part-b--guide-mode-appguidetsx)
- [3. Zero-Backend AI Stack](#3-zero-backend-ai-stack)
- [4. Key Technical Highlights & Invariants](#4-key-technical-highlights--invariants)
  - [1. NFC Devanagari-to-Urdu Transliteration Engine](#1-nfc-devanagari-to-urdu-transliteration-engine)
  - [2. Accelerometer Gait Detection with 2.5s Step Decay](#2-accelerometer-gait-detection-with-25s-step-decay)
  - [3. Ambient Light Auto-Torch with Dual Hysteresis](#3-ambient-light-auto-torch-with-dual-hysteresis)
  - [4. Media Volume Floor Enforcement](#4-media-volume-floor-enforcement)
  - [5. CameraX Reentrant Photo Capture Mutex](#5-camerax-reentrant-photo-capture-mutex)
  - [6. Acoustic Dampening & Echo-Gated Speech Loop](#6-acoustic-dampening--echo-gated-speech-loop)
- [5. Project Directory Tree](#5-project-directory-tree)
- [6. Environment Setup & Configuration](#6-environment-setup--configuration)
  - [Environment Variables (`.env.local`)](#environment-variables-envlocal)
  - [API Quotas and Rate Limits](#api-quotas-and-rate-limits)
- [7. Running Locally & Building Standalone APKs](#7-running-locally--building-standalone-apks)
  - [Local Development with Expo Dev Client](#local-development-with-expo-dev-client)
  - [EAS Cloud Compilation (`arm64-v8a` APK)](#eas-cloud-compilation-arm64-v8a-apk)
- [8. Strict Architectural Exclusions](#8-strict-architectural-exclusions)

---

## 1. Assistive Mission & Vision

Navigating daily civic life presents immense friction for individuals with sensory disabilities. In noisy environments with complex multi-lingual dialogues (Urdu Nastaliq, Pakistani English, and rapid code-switching), existing assistive apps frequently fail due to:
1. High dependency on brittle, self-hosted backend servers or complex cloud subscriptions.
2. Poor speech recognition on regional code-switching resulting in Hindi Devanagari transliteration leaks.
3. Laggy obstacle detection pipelines that freeze or drain device batteries.
4. UI interfaces cluttered with small buttons and toggles that are impossible for blind individuals to operate without visual feedback.

**Comfety** completely removes these barriers. It operates as a **100% client-driven, zero-backend native application**. By orchestrating two free-tier cloud endpoints (Groq Whisper and Google Gemini 3.8 Flash) with two on-device local engines (quantized TensorFlow Lite and native OS neural TTS), Comfety delivers instant spatial guidance, real-time code-switched transcription, and expressive vocal synthesis at zero operational hosting cost.

---

## 2. Dual-Modality Architecture

Comfety is structured around two distinct operational modes designed for contrasting disability profiles:

```
                                  ┌──────────────────────────────┐
                                  │      Comfety Home Screen     │
                                  │      (50/50 Screen Split)    │
                                  │   + 2s Hold Glass Gesture    │
                                  │   + Accelerometer 2x Shake   │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │  Part A: Conversation Mode    │                 │      Part B: Guide Mode       │
        │   (Deaf / Mute Users)         │                 │   (Blind / Low-Vision Users)  │
        ├───────────────────────────────┤                 ├───────────────────────────────┤
        │ • Continuous Urdu/English STT │                 │ • On-Device TFLite Obstacles  │
        │ • RMS Silence Decibel Meter   │                 │ • 7s Walking Hazard Detection │
        │ • 6-Preset Neural Human TTS   │                 │ • Smart 1x Tap Audio Scanner  │
        │ • 40px High-Contrast Counter  │                 │ • 2x Tap Plain Simplification │
        │ • Saved Quick-Reply System    │                 │ • Auto-Torch Ambient Light    │
        └───────────────────────────────┘                 └───────────────────────────────┘
```

### Persona-to-Mode Mapping

| User Persona | Primary Mode | Input Interaction | Assistive Output |
| :--- | :--- | :--- | :--- |
| **Blind / Low-Vision** | **Part B: Guide Mode** (`/guide`) | Full-screen single/double tap, long-press glass hold, phone shake, spoken queries | Concise spoken voice, high-priority spatial obstacle alerts, haptic feedback |
| **Mute / Speech-Impaired** | **Part A: Conversation Mode** (`/conversation`) | Quick-reply chips, custom saved sentences, on-screen keyboard | Realistic neural human voice, full-screen `40px` counter display card |
| **Deaf / Hard-of-Hearing** | **Part A: Conversation Mode** (`/conversation`) | Directional device microphone angled toward speaker | Live continuous Urdu/English bilingual captions, real-time decibel RMS meter |
| **Deaf-Mute (Two-Way Relay)** | **Part A: Conversation Mode** (`/conversation`) | Microphone audio capture + typed/quick reply chips | Dual relay: spoken TTS vocalization + full-screen counter display card |

---

### Zero-Precision Launch Screen (`app/index.tsx`)

Traditional accessibility applications often make the mistake of placing small mode switches or settings icons in corners. Comfety enforces a **Zero-Precision Entry Standard**:

1. **Zero Small Buttons on Launch:** The home viewport contains no small top-corner icons, floating action buttons, or precision toggles.
2. **Automatic Spoken Onboarding:** When the launch screen gains focus, `expo-speech` immediately speaks:
   > _"Welcome to Comfety. Tap the top half for Conversation Mode. Tap the bottom half, hold anywhere for two seconds, or shake the phone to start Guide Mode."_
   Audio is automatically canceled with `Speech.stop()` before route transitions to prevent audio overlap.
3. **50/50 Full-Width Touch Zones:** The screen is divided into two equal full-width vertical halves (`flex: 1`):
   - **Top Half (`#0D1527`):** Launches Conversation Mode.
   - **Bottom Half (`#131B2E`):** Launches Guide Mode.
4. **No-Look Blind Triggers:**
   - **Universal Glass Hold (`delayLongPress={2000}`):** Pressing and holding anywhere on the glass for 2 seconds immediately opens Guide Mode.
   - **Accelerometer Double-Shake:** Sensed via `expo-sensors` Accelerometer (`150ms` sampling). If two acceleration spikes exceeding `2.1g` occur within a `1000ms` window, the app immediately executes haptic confirmation and routes to Guide Mode hands-free.
5. **Persistent Mode Memory:** Persists user preferences (`comfety_preferred_mode` and `comfety_auto_open`) in `AsyncStorage`. Booting with `/?select=true` bypasses auto-open to allow easy mode switching.

---

### Part A — Conversation Mode (`app/conversation.tsx`)

Designed for noisy public counters (pharmacies, banks, fruit markets, clinic reception desks):

- **Continuous Bilingual Transcription:** Audio captured via `expo-audio` (`useAudioRecorder`) is streamed in 4-second chunks to Groq's `whisper-large-v3-turbo`. Conditioned specifically on Urdu Nastaliq and English vocabulary (`"Urdu and English mixed conversation. السلام علیکم، یہ کتنے کا ہے؟"`).
- **RMS Decibel Meter Bar:** Real-time animated audio level bar providing instant visual confirmation to deaf users that the microphone is registering the conversation partner's voice above ambient room noise.
- **Natural Multi-Voice TTS Engine:** 6 distinct OS neural voices across Urdu and English locales:
  - *Fatima* (Urdu Warm Female, 1.0 pitch / 1.0 rate)
  - *Tariq* (Urdu Deep Male, 0.88 pitch / 0.92 rate)
  - *Sarah* (English US Clear Female, 1.0 pitch / 1.0 rate)
  - *David* (English US Deep Male, 0.88 pitch / 0.95 rate)
  - *Emma* (English UK Friendly Female, 1.08 pitch / 1.02 rate)
  - *Oliver* (English UK Professional Male, 0.92 pitch / 0.94 rate)
- **High-Contrast 40px Counter Display:** Single tap on any message expands it into a full-screen, high-contrast modal (`CounterDisplayModal`) rendering `40px` bold text with Urdu Nastaliq line heights (`lineHeight >= fontSize * 1.6`). Can be held across a counter or partition in loud bazaars where speakers are inaudible.
- **Saved Phrases & Quick Replies:** Categorized two-row quick-reply chips for instant replies, paired with a custom modal to store and persist frequent medical or personal phrases in `AsyncStorage`.
- **TTS-to-STT Acoustic Gating:** The STT audio recorder automatically pauses during TTS vocalization and resumes `300ms` after playback completes, eliminating self-transcription audio feedback loops.

---

### Part B — Guide Mode (`app/guide.tsx`)

Engineered for blind or severely low-vision users requiring hands-free spatial navigation and document reading:

- **Full-Screen Unified Gesture Surface:**
  - **Single Tap (1x Tap):** Haptic confirmation. Listens for 2,500ms for an optional spoken question (e.g., _"What medicine is this?"_ or _"Read the total on this bill"_). If the user remains silent, it automatically captures the camera frame and executes full scene reading.
  - **Double Tap (2x Tap):** Triggers contextual simplification. Gemini re-explains the prior visual output using 5th-grade vocabulary and short sentences without technical jargon.
  - **Long Press (1.5s Hold):** Toggles real-time obstacle alert scanning on/off with descriptive audio confirmation.
- **Priority Obstacle Interrupts:** Any physical hazard detected in the path immediately invokes `Speech.stop()`, fires an urgent error haptic pattern, and speaks a concise directional warning (`<= 5 words`, e.g., _"Person close ahead"_, _"Vehicle on left"_).
- **Markdown-Free Clean Audio:** Strips all markdown formatting (`*`, `**`, `#`, bullet characters) before sending to `expo-speech`, preventing annoying TTS artifacts like the literal recitation of _"asterisk asterisk"_ or Urdu _"sitara sitara"_.

---

## 3. Zero-Backend AI Stack

Comfety requires zero custom Node.js, Python, or Docker backend servers. All computation is handled on-device or routed directly from the client to public free-tier endpoints:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           COMFETY ZERO-BACKEND RUNTIME                           │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
┌───────────────────────────────────┐             ┌───────────────────────────────────┐
│     CLIENT CLOUD ENDPOINTS        │             │      ON-DEVICE LOCAL ENGINES      │
├───────────────────────────────────┤             ├───────────────────────────────────┤
│ 1. Groq Cloud Speech API          │             │ 1. Google EfficientDet-Lite0      │
│    • Model: whisper-large-v3-turbo│             │    • Library: react-native-fast-  │
│    • Purpose: Bilingual STT       │             │      tflite + vision-camera       │
│    • Quota: 20 RPM / 2,000 RPD    │             │    • Frame: 320x320 uint8 RGB     │
│    • Rate Limit: Max 1 req / 4s   │             │    • Speed: >= 10 FPS (Zero Net)  │
│                                   │             │                                   │
│ 2. Google Gemini 3.8 Flash        │             │ 2. Expo Speech Engine             │
│    • SDK: @google/genai           │             │    • Library: expo-speech         │
│    • Primary: gemini-3.8-flash    │             │    • Voice: 6 neural presets      │
│    • Fallback: gemini-3.5-flash-  │             │    • Quota: Unlimited (Zero Net)  │
│      lite (7s Walking Hazards)    │             │    • Echo buffer: 300ms pause     │
│    • Quota: 15 RPM / 1M TPM       │             │                                   │
└───────────────────────────────────┘             └───────────────────────────────────┘
```

### Comprehensive Engine Specification

| Capability | Engine / Model | Implementation | Rate Limit / Quota | Network Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Bilingual STT** | `whisper-large-v3-turbo` | Groq REST API (`https://api.groq.com/openai/v1/audio/transcriptions`) | Enforced interval: `>= 4000ms`<br>Free ceiling: 20 RPM / 2,000 RPD | Cloud (Free-Tier) |
| **Scene Vision & OCR** | `gemini-3.8-flash` (`media_resolution: "high"`) | `@google/genai` TypeScript SDK with multi-turn in-memory context | Enforced interval: `>= 2000ms`<br>Free ceiling: 15 RPM / 1M TPM | Cloud (Free-Tier) |
| **Structural Hazards** | `gemini-3.5-flash-lite` (`media_resolution: "low"`) | `@google/genai` client, 512x384 JPEG frame inspection | Enforced interval: `>= 7000ms`<br>Max ~8.5 RPM (Active on walking only) | Cloud (Free-Tier) |
| **Obstacle Radar** | `efficientdet-lite0.tflite` | `react-native-fast-tflite` with `react-native-vision-camera-resizer` | Real-time (`>= 10 FPS`), zero latency | **100% On-Device (0 Network Calls)** |
| **Natural Vocal TTS** | Native OS Neural TTS | `expo-speech` with 6 calibrated pitch/rate voice presets | Real-time on-demand audio playback | **100% On-Device (0 Network Calls)** |

---

## 4. Key Technical Highlights & Invariants

### 1. NFC Devanagari-to-Urdu Transliteration Engine
**File:** [`src/utils/devanagariToUrdu.ts`](src/utils/devanagariToUrdu.ts)

When transcribing mixed Urdu-English speech in noisy environments, Whisper models occasionally default to Hindi Devanagari Unicode characters (`\u0900-\u097F`). Comfety integrates an ultra-fast (< 1ms execution on Hermes), zero-dependency transliterator:

- **NFC Precomposed vs. Decomposed Nuktas:** Standard text processing often misses decomposed Unicode sequences. Comfety normalizes text to NFD, handles composite nuktas, and accurately converts both single-codepoint NFC nuktas and decomposed sequences (`\u0958` क़ -> `ق`, `\u0959` ख़ -> `خ`, `\u095A` ग़ -> `غ`, `\u095B` ज़ -> `ز`, `\u095C` ड़ -> `ڑ`, `\u095D` ढ़ -> `ڑھ`, `\u095E` फ़ -> `ف`, `\u095F` य़ -> `ی`).
- **Context-Aware Positional Orthography:** 
  - *Bari Ye (`ے`):* In Urdu orthography, Bari Ye is strictly a word-final character. The engine inspects lookahead tokens: medial positions use Chhoti Ye (`ی`), while word boundaries map to Bari Ye (`ے`).
  - *Noon Ghunna (`ں`):* Dotless Noon Ghunna only occurs at the end of words. In medial positions, the engine substitutes dotted Noon (`ن`).
- **Lexicon Pre-Processing:** An instant lookup dictionary (`COMMON_WORD_MAP`) converts high-frequency Hindi conversational expressions into natural Pakistani Urdu Nastaliq (e.g., `नमस्ते` -> `السلام علیکم`, `धन्यवाद` -> `شکریہ`, `दवा` -> `دوا`).

```typescript
// Example: Converting Hindi Whisper output to legitimate Urdu Nastaliq
const rawWhisper = "नमस्ते, यह दवा कितने की है?";
const urduOutput = devanagariToUrdu(rawWhisper);
// Output: "السلام علیکم، یہ دوا کتنے کی ہے؟"
```

---

### 2. Accelerometer Gait Detection with 2.5s Step Decay
**File:** [`src/hooks/useObstacleLoop.ts`](src/hooks/useObstacleLoop.ts)

Structural drop-offs (stairs, curbs, open sewer gutters) cannot be reliably detected by standard COCO 2D bounding-box models. However, querying Gemini every 7 seconds when the user is sitting or standing still would rapidly deplete free-tier API quotas.

- **Heel-Strike Acceleration Signature:** Subscribes to `expo-sensors` Accelerometer at `250ms` (`4 Hz`). When total acceleration magnitude $\sqrt{x^2 + y^2 + z^2} > 1.25g$, the user is marked as actively walking.
- **2,500ms Step Decay Window:** A 500ms polling timer monitors elapsed time since the last walking spike (`Date.now() - lastWalkingSpikeRef.current >= 2500`). If no steps are taken for 2.5 seconds, walking state immediately decays to `false`, instantly suspending background Gemini hazard queries.
- **Strict 7,000ms Hazard Interval:** When walking, Gemini hazard checks fire at most once every 7,000ms (`<= 8.5 RPM`), well below Gemini's 15 RPM limit.

---

### 3. Ambient Light Auto-Torch with Dual Hysteresis
**File:** [`src/hooks/useAutoTorch.ts`](src/hooks/useAutoTorch.ts)

Blind users cannot see whether a room is dark or whether their camera has enough illumination to read a medicine label or utility bill.

- **Dual-Threshold Hysteresis:**
  - **Turn ON:** Ambient lux `< 15 lux` sustained for **2 consecutive readings** (1,000ms) activates the camera torch.
  - **Turn OFF:** Ambient lux `> 45 lux` sustained for **3 consecutive readings** (1,500ms) turns the torch off.
  - **Deadband (15–45 lux):** Prevents rapid torch flickering/strobing when standing near dim shadows or passing overhead lamps.
- **Voice Override:** If the user speaks a voice command (e.g., _"Turn on light"_ or _"Turn off light"_), the auto-torch listener is overridden to respect the user's manual preference.

---

### 4. Media Volume Floor Enforcement
**File:** [`src/services/volumeService.ts`](src/services/volumeService.ts)

A blind user navigating with an audio assistant is in grave danger if their device media volume was accidentally muted or turned down in another application.

- **50% Hardware Volume Floor:** Uses `react-native-volume-manager` to guarantee that physical device media volume is at least `0.5` (`50%`) upon app launch.
- **Foreground Lifecycle Synchronization:** Subscribes to React Native `AppState` changes. Whenever the application transitions from background or lock screen back to `active`, it verifies device volume and silently scales it up to `0.5` if it was muted externally.

---

### 5. CameraX Reentrant Photo Capture Mutex
**File:** [`app/guide.tsx`](app/guide.tsx)

Under Android's CameraX architecture, invoking `photoOutput.capturePhoto()` while another photo capture is in progress throws an unrecoverable `OperationCanceledException` or native crash.

- **Reentrant Mutex Lock:** `isCapturingPhotoRef` coordinates photo capture between the automatic 7-second structural hazard loop and the user's on-demand tap-to-read action.
- **Non-Blocking Backoff:** When a user taps to read, the system yields in 50ms intervals (up to 400ms max) for any in-flight background capture to finish before acquiring the camera lock.
- **In-Memory Bitwise Base64 & Instant Disposal:** Photos are captured to memory, converted to Base64 via a pure bitwise algorithm (`uint8ArrayToBase64`), and the native image buffer is immediately released via `photo.dispose()` to eliminate native memory leaks.

---

### 6. Acoustic Dampening & Echo-Gated Speech Loop
**File:** [`src/hooks/useAudioChunker.ts`](src/hooks/useAudioChunker.ts) & [`src/services/ttsManager.ts`](src/services/ttsManager.ts)

In Conversation Mode, a microphone transcribing ambient sound will inadvertently capture the phone's own speaker output if both operate concurrently:

- **Playback Mutex:** When TTS begins speaking, `useAudioChunker` recording is actively suspended.
- **300ms Acoustic Dampening Buffer:** After `expo-speech` emits its `onDone` or `onError` callback, recording waits an additional `300ms` for physical acoustic reverberation to dissipate before re-arming the microphone.
- **RMS Silence Gating:** Discards all audio chunks quieter than `-35 dB` locally before uploading, preventing empty room noise from consuming Groq STT quota.

---

## 5. Project Directory Tree

```
comfety-app/
├── app/                                    # Expo Router File-Based Routing
│   ├── _layout.tsx                         # Root layout (Volume sync, global fonts, dark theme)
│   ├── index.tsx                           # Zero-precision 50/50 launch screen (Shake, 2s hold)
│   ├── conversation.tsx                    # Part A: Conversation Mode (Live STT, TTS, Counter card)
│   └── guide.tsx                           # Part B: Guide Mode (Vision Camera, Gestures, Auto-torch)
├── assets/
│   ├── icon.png                            # Application icon
│   ├── splash-icon.png                     # Native splash screen icon
│   └── models/
│       └── efficientdet-lite0.tflite       # Quantized Google COCO obstacle detection model
├── src/
│   ├── components/
│   │   ├── CounterDisplayModal.tsx         # 40px full-screen counter card for noisy bazaars
│   │   ├── SavePhraseModal.tsx             # Modal to save custom accessibility phrases
│   │   └── VoiceSelectorModal.tsx          # Modal to select from 6 neural human TTS voices
│   ├── constants/
│   │   ├── config.ts                       # AI models, sensor thresholds, rate limit ceilings
│   │   ├── quickReplies.ts                 # Default bilingual conversational quick replies
│   │   └── theme.ts                        # Stitch Obsidian Clarity design tokens & colors
│   ├── hooks/
│   │   ├── useAudioChunker.ts              # expo-audio chunking & RMS silence thresholding
│   │   ├── useAutoTorch.ts                 # Ambient light sensor auto-torch with hysteresis
│   │   ├── useObstacleLoop.ts              # TFLite frame processor & 2.5s gait decay loop
│   │   └── useShakeGesture.ts              # Accelerometer double-shake detector for blind entry
│   ├── services/
│   │   ├── geminiVision.ts                 # Google Gemini 3.8 Flash & 3.5 Flash Lite SDK service
│   │   ├── groqStt.ts                      # Groq Whisper Large v3 Turbo transcription client
│   │   ├── ttsManager.ts                   # expo-speech wrapper with 6 calibrated voices
│   │   └── volumeService.ts                # Hardware media volume floor enforcement
│   ├── types/
│   │   ├── env.d.ts                        # TypeScript environment variable definitions
│   │   └── index.ts                        # Comprehensive application TypeScript interfaces
│   └── utils/
│       ├── devanagariToUrdu.ts             # Devanagari to Urdu Nastaliq transliterator
│       └── permissions.ts                  # Camera, microphone, and sensor permission utils
├── app.json                                # Expo configuration (build properties, permissions)
├── eas.json                                # EAS Build profiles (development, preview APK)
├── metro.config.js                         # Bundler configuration (.tflite asset support)
├── package.json                            # Dependencies & project scripts
├── tsconfig.json                           # Strict TypeScript configuration
└── .env.example                            # Example environment variables template
```

---

## 6. Environment Setup & Configuration

### Environment Variables (`.env.local`)

Comfety uses Expo's public environment variable scheme (`EXPO_PUBLIC_*`). Create a `.env.local` file in the root of your workspace:

```bash
cp .env.example .env.local
```

Populate the required free-tier API keys:

```ini
# Groq Cloud Whisper STT API Key (Obtain from https://console.groq.com)
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_api_key_here

# Google Gemini API Key (Obtain from https://aistudio.google.com)
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
```

> **Security Note:** In accordance with the zero-backend architecture, these client keys are read directly by `src/constants/config.ts`. For production builds, restrict your Google AI Studio key by Android package name (`com.madg0blin.comfety`) and SHA-1 certificate fingerprint.

### API Quotas and Rate Limits

The application strictly guards API consumption to guarantee indefinite free-tier operation:

| Endpoint | Free Tier Allowance | Comfety Throttle Limit | Guard Implementation |
| :--- | :--- | :--- | :--- |
| **Groq Whisper** | 20 RPM / 2,000 RPD | **15 RPM** (1 upload per 4,000ms) | RMS silence gating + `RATE_LIMITS.GROQ_MIN_INTERVAL_MS` |
| **Gemini Vision (On-Demand)** | 15 RPM / 1M TPM | **15 RPM** (1 query per 2,000ms) | Gestures & voice query debounce + multi-turn history trimming |
| **Gemini Hazards (Walking)** | 15 RPM / 1M TPM | **8.5 RPM** (1 query per 7,000ms) | Accelerometer walking gate + 2.5s step decay window |

---

## 7. Running Locally & Building Standalone APKs

Because Comfety utilizes custom native modules (`react-native-fast-tflite`, `react-native-vision-camera`, `react-native-vision-camera-resizer`, and `react-native-volume-manager`), **it cannot run inside the standard Expo Go sandbox app**. It must be run using a custom development client or compiled into a standalone APK.

### Local Development with Expo Dev Client

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Verify Environment Variables:**
   Confirm that `.env.local` exists and contains valid Groq and Gemini API keys.

3. **Compile and Run on Connected Android Device:**
   Ensure Android Studio / ADB is configured with a connected device or emulator running Android 8.0+ (API Level 26+):
   ```bash
   npx expo run:android
   ```

4. **Start the Bundler:**
   ```bash
   npx expo start --dev-client
   ```

---

### EAS Cloud Compilation (`arm64-v8a` APK)

Comfety is pre-configured with Expo Application Services (EAS) to compile standalone, installable `.apk` binaries directly in the cloud without requiring local Android Studio installations.

#### 1. Install EAS CLI and Authenticate
```bash
npm install -g eas-cli
eas login
```

#### 2. Configure EAS Project
```bash
eas project:init
```

#### 3. Build Standalone Preview APK
The `preview` profile in [`eas.json`](eas.json) compiles a standalone `apk` distribution for internal device testing:
```bash
eas build --platform android --profile preview
```

#### 4. Architecture Verification
The project configuration in [`app.json`](app.json) explicitly targets 64-bit ARM architectures:
```json
[
  "expo-build-properties",
  {
    "android": {
      "minSdkVersion": 26,
      "buildArchs": ["arm64-v8a"]
    }
  }
]
```
This guarantees maximum execution speed for TensorFlow Lite SIMD neural operations and reduces APK distribution size.

---

## 8. Strict Architectural Exclusions

To maintain stability, performance, and compliance with the zero-backend charter, Comfety adheres to strict engineering invariants:

- ❌ **No `expo-av`:** Deprecated in modern Expo SDKs; causes fatal native JSI `UnsatisfiedLinkError` crashes. Replaced entirely by `expo-audio` and `expo-asset`.
- ❌ **No Heavy LangChain or Cloud Vector Databases:** Vector embeddings and remote RAG frameworks introduce unnecessary latency and cost. User accessibility context is injected directly into `systemInstruction` via client `AsyncStorage`.
- ❌ **No External Backend Servers:** Zero dependency on Node.js, Express, Fastify, Flask, Django, or Docker containers.
- ❌ **No Deprecated Gemini Parameters:** Gemini 3.8 Flash strictly forbids deprecated sampling flags (`temperature`, `top_p`, `top_k`) and enforces valid user-terminated message turns.
- ❌ **Strict Type Safety:** Zero `any` types across all custom modules, complete TypeScript strictness, and fail-safe hardware error handling.

---

<div align="center">
  <sub>Comfety — Built with empathy and precision for accessibility in Pakistan and beyond.</sub>
</div>
