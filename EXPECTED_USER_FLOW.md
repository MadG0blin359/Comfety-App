# Comfety — User Journeys & Accessibility Interaction Flows

This document defines the end-to-end user actions and expected system responses across all supported accessibility profiles. Antigravity must reference these flows when implementing UI state transitions, gesture handlers, audio queues, and hardware fallback logic.

## Persona-to-Mode Mapping

| User Profile                           | Primary Mode                                         | Primary Input Modality                                           | Primary Output Modality                                                    |
| :------------------------------------- | :--------------------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------- |
| **Blind / Low-Vision**                 | Part B: Guide Mode (`/guide`)[cite: 1]               | Full-screen touch gestures, shake, spoken voice queries[cite: 1] | Spoken TTS explanations, priority hazard alerts, haptic pulses[cite: 1]    |
| **Mute / Speech-Impaired (Can Hear)**  | Part A: Conversation Mode (`/conversation`)[cite: 1] | Quick-reply chips, saved phrases, typed text[cite: 1]            | Natural human TTS voice, `40px` full-screen display card[cite: 1]          |
| **Deaf / Hard-of-Hearing (Can Speak)** | Part A: Conversation Mode (`/conversation`)[cite: 1] | Directional microphone audio capture[cite: 1]                    | Real-time bilingual captions (Urdu/English), live RMS audio meter[cite: 1] |
| **Deaf-Mute (Cannot Hear or Speak)**   | Part A: Conversation Mode (`/conversation`)[cite: 1] | Microphone capture + quick replies / typed text[cite: 1]         | Real-time bilingual captions + natural TTS / `40px` display card[cite: 1]  |

---

## 1. Blind or Low-Vision Users (Part B: Guide Mode)

### A. Launching and Entering the App (Zero-Vision Setup)

1. **Open Application:** The user opens the **Comfety** application on their smartphone.
2. **Automatic Spoken Onboarding:** Upon screen mount, the app automatically plays a spoken welcome prompt without requiring any button press.
3. **No-Look Entry Action:** The user enters **Guide Mode** using any zero-precision gesture:
   - Tap anywhere on the bottom half of the screen.
   - Press and hold anywhere on the screen glass for `2000ms`.
   - Shake the phone twice.
4. **Entry Confirmation:** The device emits a confirmation haptic vibration and speaks: _"Guide Mode active. Obstacle alerts on."_
   - _Subsequent Launches:_ When persistent auto-open is enabled, the app bypasses the entry screen and boots directly into **Guide Mode**.

### B. Navigating Safely with Proactive Obstacle Alerts

5. **Walking Posture:** The user holds the phone facing forward at chest or waist level while walking.
6. **Proactive Hazard Warnings:** Whenever the camera pipeline detects physical hazards in time—specifically **stairs, open drains, vehicles, and people**[cite: 1]—the app immediately interrupts active speech, triggers an urgent haptic pattern, and speaks a concise directional warning.
7. **Toggling Obstacle Scanning:** The user presses and holds anywhere on the screen for `1500ms` to pause or resume continuous obstacle alerts.

### C. Reading Labels, Signs, Bills, and Surroundings

8. **Camera Aiming:** The user points the rear camera toward a physical object, medicine label, sign, or bill[cite: 1].
9. **Single-Tap Capture:** The user taps once anywhere on the screen and receives an immediate haptic tick confirmation.
10. **Voice Query or Auto-Read Fallback:**
    - _Spoken Question:_ The user asks a question aloud (for example, _"What medicine is this?"_ or _"What is in front of me?"_)[cite: 1].
    - _Zero-Speech Fallback:_ If the user remains silent for `2500ms`, the app automatically captures the frame, enables the camera torch if ambient brightness is low, and performs scene description and text reading.
11. **Spoken Readout:** The AI voice assistant describes the surroundings or reads the printed text aloud[cite: 1].

### D. Simplifying Confusing Information

12. **Simplification Request:** If the spoken explanation is difficult to understand, the user double-taps anywhere on the screen (or says _"Explain that in simpler words"_)[cite: 1].
13. **Simplified Response:** The assistant restates the previous explanation using shorter sentences and simpler everyday words[cite: 1].

---

## 2. Mute or Speech-Impaired Users Who Can Hear (Part A: Conversation Mode)

### A. Setup and Voice Personalization

1. **Enter Conversation Mode:** The user opens **Comfety** and taps the large top half of the screen (**Conversation Mode**).
2. **Select Speaking Voice:** The user taps the top-bar voice selector and chooses one of at least **4 distinct human voices** that best suits them[cite: 1].
3. **Store Custom Phrases:** The user taps **`+ Save Phrase`** to save frequently used personal sentences (such as medical details, addresses, or common requests) for rapid reuse[cite: 1].

### B. Communicating in Live Conversations

4. **Listen Directly:** The user listens directly to the conversation partner speaking.
5. **Rapid Quick Replies:** During time-sensitive interactions, the user taps a saved sentence or one-tap quick-reply chip (such as _"Assalam-o-Alaikum"_, _"Please speak slowly"_, or _"How much is this?"_) so the app speaks immediately without delay[cite: 1].
6. **Custom Typed Replies:** For custom responses, the user types the exact sentence into the input field and taps **`Speak`** to vocalize the message verbatim in a warm, realistic human voice[cite: 1].
7. **High-Noise Visual Fallback:** In loud environments such as a bazaar, clinic, or bank where the phone speaker may be difficult to hear[cite: 1], the user taps **`Show Large`** on the reply card to display the message in full-screen `40px` high-contrast text across a counter.

---

## 3. Deaf or Hard-of-Hearing Users Who Can Speak (Part A: Conversation Mode)

### A. Capturing Live Bilingual Speech

1. **Enter Conversation Mode:** The user opens **Comfety** and taps the top half of the screen (**Conversation Mode**).
2. **Microphone Positioning:** The user holds the phone angled toward the conversation partner in environments such as a bazaar, clinic, or bank[cite: 1].
3. **Visual Acoustic Verification:** The user checks the animated audio level meter in the top bar to visually confirm that the microphone is capturing sound above ambient background noise[cite: 1].
4. **Real-Time Bilingual Transcription:** The user reads the other person's words appearing continuously on screen in real time, supporting **Urdu, English, and mixed Urdu-English within the same sentence**[cite: 1].

### B. Responding

5. **Spoken or Typed Reply:** The user replies directly using their own spoken voice, or optionally uses the typed text and quick-reply features if preferred[cite: 1].

---

## 4. Deaf-Mute Users — Cannot Hear or Speak (Part A: Two-Way Relay)

### A. Conducting a Full Visual and Spoken Exchange

1. **Enter Conversation Mode:** The user opens **Comfety** and taps the top half of the screen (**Conversation Mode**).
2. **Capture Partner Speech:** The user angles the phone's microphone toward the other person (such as a doctor, bank teller, or shopkeeper)[cite: 1].
3. **Read Live Captions:** The user monitors the live audio meter and reads the real-time Urdu, English, or code-switched captions as they appear on screen[cite: 1].
4. **Broadcast Reply (Echo-Gated):** The user taps a saved quick-reply chip or types a custom reply and taps **`Speak`** to broadcast the exact text aloud[cite: 1]. The app automatically pauses microphone recording during TTS playback so it does not transcribe its own spoken output.
5. **Counter Readability & Turn Continuation:** If background noise prevents the other person from hearing the spoken output[cite: 1], the user taps **`Show Large`** to display the reply in `40px` high-contrast text, then angles the phone back toward the other person to read their next spoken response[cite: 1].
