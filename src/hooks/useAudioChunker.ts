import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { AUDIO_METERING_CONFIG } from '../constants/config';
import { transcribeAudio, isUrduScript, isAbortOrCancelError, isWhisperHallucination } from '../services/groqStt';
import { TranscriptItem } from '../types';

interface UseAudioChunkerOptions {
  enabled?: boolean;
}

interface UseAudioChunkerReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  meterLevel: number; // 0.0 to 1.0 for visual decibel meter
  currentDb: number;  // raw dB from -60 to 0
  transcripts: TranscriptItem[];
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseForTts: () => void;
  resumeAfterTts: () => void;
  clearTranscripts: () => void;
  addUserReply: (text: string) => void;
}

export function useAudioChunker({ enabled = true }: UseAudioChunkerOptions = {}): UseAudioChunkerReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDbInChunkRef = useRef<number>(-100);
  const speechFramesInChunkRef = useRef<number>(0);
  const isPausedForTtsRef = useRef<boolean>(false);
  const isLoopRunningRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const MIN_SPEECH_FRAMES = 4; // At least 4 polls (400ms of active speech > -35dB) required to discard transient clicks/rustles

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  // Track real-time audio metering via useAudioRecorderState (100ms polling for smooth meter UI)
  const recorderState = useAudioRecorderState(recorder, 100);

  // Real-time audio metering derived from recorderState (pure computation, no duplicate state)
  const currentDb =
    isRecording && typeof recorderState.metering === 'number'
      ? recorderState.metering
      : -60;

  const meterLevel =
    isRecording && typeof recorderState.metering === 'number'
      ? Math.max(0, Math.min(1, (recorderState.metering + 60) / 60))
      : 0;

  useEffect(() => {
    // Track peak dB and speech frames while actively recording
    if (!isRecording) {
      return;
    }

    if (typeof recorderState.metering === 'number') {
      const db = recorderState.metering;
      maxDbInChunkRef.current = Math.max(maxDbInChunkRef.current, db);

      if (db >= AUDIO_METERING_CONFIG.rmsSilenceThresholdDb) {
        speechFramesInChunkRef.current += 1;
      }
    }
  }, [recorderState.metering, isRecording]);

  // Stop current chunk, upload if speech detected, and immediately spin up next chunk
  const cycleAudioChunk = useCallback(async () => {
    if (!isLoopRunningRef.current) return;

    try {
      // 1. Capture completed chunk URI, peak dB, and speech duration frames
      const peakDb = maxDbInChunkRef.current;
      const speechFrames = speechFramesInChunkRef.current;
      maxDbInChunkRef.current = -100;
      speechFramesInChunkRef.current = 0;

      await recorder.stop();
      const chunkUri = recorder.uri;

      // 2. Immediately prepare and record next interval so no audio is dropped
      if (isLoopRunningRef.current && !isPausedForTtsRef.current) {
        await recorder.prepareToRecordAsync({
          ...RecordingPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        });
        recorder.record();
      }

      // 3. RMS Silence & Transient Noise Gating:
      // Discard chunk if below threshold or if speech energy was too brief (< 300ms)
      if (isPausedForTtsRef.current) {
        return;
      }

      if (peakDb < AUDIO_METERING_CONFIG.rmsSilenceThresholdDb || speechFrames < MIN_SPEECH_FRAMES) {
        // Silent interval or transient noise (tap click, haptic buzz) — discard locally with 0 API calls
        return;
      }

      if (!chunkUri) return;

      // 4. Send non-silent audio chunk to Groq Whisper
      setIsTranscribing(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await transcribeAudio(chunkUri, { signal: controller.signal });
      const trimmedText = result.text.trim();

      // Filter out empty results and Whisper hallucinations on silence / brief noise
      if (trimmedText.length > 0 && !isWhisperHallucination(trimmedText)) {
        // Discard low-confidence prompt echo on low-energy chunks
        if (
          speechFrames < 5 &&
          (trimmedText === 'سلام علیکم' ||
            trimmedText === 'السلام علیکم' ||
            trimmedText === 'یہ کتنے کا ہے؟')
        ) {
          console.log('[AudioChunker] Discarded low-confidence prompt echo:', trimmedText);
          return;
        }

        const newItem: TranscriptItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          text: trimmedText,
          sender: 'partner',
          timestamp: Date.now(),
          isUrdu: isUrduScript(trimmedText),
        };

        setTranscripts((prev) => [...prev, newItem]);
      }
    } catch (err: unknown) {
      if (isAbortOrCancelError(err) || !isLoopRunningRef.current) {
        // Ignored on navigation or manual pause/stop. Never surface as error!
        return;
      }
      console.warn('[AudioChunker] Chunk transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription error');
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder]);

  // Start continuous audio chunking loop
  const startRecording = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required for live transcription.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      isLoopRunningRef.current = true;
      setIsRecording(true);
      setError(null);
      maxDbInChunkRef.current = -100;
      speechFramesInChunkRef.current = 0;

      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recorder.record();

      // Clear any mechanical tap / haptic vibration spikes from initial 250ms
      setTimeout(() => {
        if (isLoopRunningRef.current) {
          maxDbInChunkRef.current = -100;
          speechFramesInChunkRef.current = 0;
        }
      }, 250);

      // Schedule recurring 4000ms chunk boundaries
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = setInterval(() => {
        cycleAudioChunk();
      }, AUDIO_METERING_CONFIG.chunkDurationMs);
    } catch (err: unknown) {
      console.error('[AudioChunker] Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
      isLoopRunningRef.current = false;
    }
  }, [cycleAudioChunk, recorder]);

  // Stop continuous chunking loop
  const stopRecording = useCallback(async () => {
    isLoopRunningRef.current = false;
    setIsRecording(false);
    setError(null);
    speechFramesInChunkRef.current = 0;
    maxDbInChunkRef.current = -100;

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch (err) {
      console.warn('[AudioChunker] Error stopping recorder:', err);
    }
  }, [recorder]);

  // Pause recording during TTS speech to prevent echo
  const pauseForTts = useCallback(() => {
    isPausedForTtsRef.current = true;
    try {
      if (recorder.isRecording) {
        recorder.pause();
      }
    } catch (err) {
      console.warn('[AudioChunker] Error pausing for TTS:', err);
    }
  }, [recorder]);

  // Resume recording 300ms after TTS finishes
  const resumeAfterTts = useCallback(() => {
    setTimeout(() => {
      isPausedForTtsRef.current = false;
      try {
        if (isLoopRunningRef.current && !recorder.isRecording) {
          recorder.record();
        }
      } catch (err) {
        console.warn('[AudioChunker] Error resuming after TTS:', err);
      }
    }, 300);
  }, [recorder]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  const addUserReply = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userItem: TranscriptItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      sender: 'user',
      timestamp: Date.now(),
      isUrdu: isUrduScript(trimmed),
    };

    setTranscripts((prev) => [...prev, userItem]);
  }, []);

  // Cleanup on unmount or when disabled
  useEffect(() => {
    let isCancelled = false;
    if (enabled) {
      const timer = setTimeout(() => {
        if (!isCancelled) {
          void startRecording();
        }
      }, 0);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
        void stopRecording();
      };
    } else {
      const timer = setTimeout(() => {
        if (!isCancelled) {
          void stopRecording();
        }
      }, 0);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }
  }, [enabled, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    meterLevel,
    currentDb,
    transcripts,
    error,
    startRecording,
    stopRecording,
    pauseForTts,
    resumeAfterTts,
    clearTranscripts,
    addUserReply,
  };
}
