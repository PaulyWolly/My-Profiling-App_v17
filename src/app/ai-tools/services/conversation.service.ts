import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

import { SpeechRecognitionLike, getRecognitionCtor, speechErrorMessage } from './voice.service';

/**
 * Hands-free Conversation Mode.
 *
 * Ported from the MERN MultiChat app's useConversationMic hook, which in turn
 * follows the one pattern that survives Chrome's speech quirks:
 *
 *   continuous = false, interimResults = false
 *   onend  → restart a session if we're still in conversation mode and not busy
 *   onerror (other than no-speech/aborted) → build a brand new instance
 *
 * Chrome ends a recognition session after every utterance, so continuous
 * listening is built by restarting short sessions rather than by asking for one
 * long one — continuous = true goes deaf after the first result.
 */

export const CONVERSATION_STATUS = {
  DEFAULT: 'Check Conversation Mode to talk, or type a message and press Send.',
  WARMUP: 'Getting ready…',
  LISTENING: 'Listening...',
  THINKING: 'Thinking...',
  SPEAKING: 'AI is speaking...',
  ERROR: 'Error occurred. Please try again.'
} as const;

export const CONVERSATION_EXIT_REPLY = "Okay. Bye for now. We'll chat later!";

/** Spoken commands that end the conversation instead of being sent to the AI. */
export function isExitPhrase(text: string): boolean {
  const value = (text || '').trim().toLowerCase().replace(/[.!?]+$/, '');
  return value === 'exit' || value === 'quit' || value === 'goodbye' || value === 'good bye';
}

/**
 * Chrome gives no gain control over speech recognition, but asking the device
 * for auto gain and leaving noise suppression off stops it from gating quiet
 * speech.
 */
const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: false,
    channelCount: 1
  }
};

/** Short prime so Chrome can open the mic — not a multi-second lockout. */
const WARMUP_MIN_MS = 250;
const WARMUP_MAX_MS = 700;
const RESTART_DELAY_MS = 100;
const ERROR_RETRY_MS = 1000;
/** Long enough for the speakers to fall silent so the mic doesn't hear the reply. */
const RESUME_AFTER_TURN_MS = 650;
/** Level meter repaints at ~10fps; every animation frame would thrash change detection. */
const LEVEL_PUBLISH_MS = 100;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  readonly active$ = new BehaviorSubject<boolean>(false);
  readonly warming$ = new BehaviorSubject<boolean>(false);
  readonly listening$ = new BehaviorSubject<boolean>(false);
  readonly status$ = new BehaviorSubject<string>(CONVERSATION_STATUS.DEFAULT);
  readonly micLevel$ = new BehaviorSubject<number>(0);
  /** Emits a finished utterance that should be sent to the AI. */
  readonly transcript$ = new Subject<string>();
  readonly error$ = new Subject<string>();

  private recognition: SpeechRecognitionLike | null = null;

  /**
   * Synchronous mirrors of the observable state. Recognition callbacks fire in
   * rapid succession and must not read a value that a pending emission hasn't
   * applied yet, which is what the refs did in the React version.
   */
  private listening = false;
  private warming = false;
  /** Results are discarded until warm-up completes, so a prime doesn't send text. */
  private armed = false;
  private thinking = false;
  private speaking = false;

  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private warmupStartedAt = 0;

  private micStream: MediaStream | null = null;
  private stopLevelMonitor: (() => void) | null = null;

  constructor(private zone: NgZone) {}

  get isActive(): boolean {
    return this.active$.value;
  }

  get supported(): boolean {
    return !!getRecognitionCtor();
  }

  setStatus(text: string): void {
    this.status$.next(text);
  }

  // Turn state --------------------------------------------------------------
  // The chat component owns the request/playback lifecycle and reports it here
  // so the mic never listens while the AI is thinking or talking.

  setThinking(value: boolean): void {
    this.thinking = value;
  }

  setSpeaking(value: boolean): void {
    this.speaking = value;
  }

  // Enable / disable --------------------------------------------------------

  async setEnabled(enabled: boolean): Promise<void> {
    if (!enabled) {
      this.clearAllTimers();
      this.active$.next(false);
      this.stop();
      this.status$.next(CONVERSATION_STATUS.DEFAULT);
      return;
    }

    if (!this.supported) {
      this.error$.next('Conversation Mode needs Chrome or Edge.');
      return;
    }

    this.clearAllTimers();
    this.disposeRecognition();

    this.thinking = false;
    this.speaking = false;
    this.active$.next(true);

    this.armed = false;
    this.warming = true;
    this.warming$.next(true);
    this.status$.next(CONVERSATION_STATUS.WARMUP);
    this.warmupStartedAt = Date.now();

    // Opening the audio stream is only needed for the level meter and the
    // device's gain settings, so listening starts without waiting on it.
    void this.beginMicCapture().catch(() => {
      this.error$.next(
        'Microphone access is required for Conversation Mode. Enable it in your browser settings.'
      );
      this.active$.next(false);
      this.warming = false;
      this.armed = false;
      this.warming$.next(false);
      this.clearAllTimers();
      this.disposeRecognition();
      this.status$.next(CONVERSATION_STATUS.DEFAULT);
    });

    this.initRecognition();
    this.startListening();

    // Hard cap — warm-up normally ends earlier, on recognition.onstart.
    this.warmupTimer = setTimeout(() => {
      this.warmupTimer = null;
      this.finishWarmup();
    }, WARMUP_MAX_MS);
  }

  /** Full stop: drops recognition, releases the mic, leaves conversation mode off. */
  stop(): void {
    this.clearWarmupTimer();
    this.warming = false;
    this.armed = false;
    this.warming$.next(false);
    this.listening = false;
    this.listening$.next(false);
    this.disposeRecognition();
    this.releaseMicCapture();
  }

  /** Silences the mic for the duration of a turn without leaving the mode. */
  pauseForTurn(): void {
    this.listening = false;
    this.listening$.next(false);
    this.disposeRecognition();
  }

  /** Re-opens the mic once the reply has finished playing. */
  resumeAfterTurn(delayMs = RESUME_AFTER_TURN_MS): void {
    this.clearResumeTimer();
    if (!this.isActive) return;

    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      if (this.isActive && !this.thinking && !this.speaking) {
        void this.enterListeningMode();
      }
    }, delayMs);
  }

  // Recognition -------------------------------------------------------------

  private canRestart(): boolean {
    return this.isActive && this.armed && !this.warming && !this.thinking && !this.speaking;
  }

  private initRecognition(): SpeechRecognitionLike | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      return null;
    }

    // Chrome only reliably delivers results with short, single-shot sessions.
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => this.zone.run(() => {
      this.listening = true;
      this.listening$.next(true);

      if (this.warming) {
        // Chrome has the mic open — end warm-up, after a floor so the badge is readable.
        const elapsed = Date.now() - (this.warmupStartedAt || Date.now());
        const remaining = Math.max(0, WARMUP_MIN_MS - elapsed);
        this.clearWarmupTimer();
        if (remaining === 0) {
          this.finishWarmup();
        } else {
          this.warmupTimer = setTimeout(() => {
            this.warmupTimer = null;
            this.finishWarmup();
          }, remaining);
        }
      } else if (this.armed) {
        this.status$.next(CONVERSATION_STATUS.LISTENING);
      }
    });

    recognition.onend = () => this.zone.run(() => {
      this.listening = false;

      if (!this.canRestart()) {
        this.listening$.next(false);
        return;
      }

      // Soft restart — hold the Listening badge so it doesn't flicker between sessions.
      this.status$.next(CONVERSATION_STATUS.LISTENING);
      this.clearRestartTimer();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.canRestart()) this.startListening();
        else this.listening$.next(false);
      }, RESTART_DELAY_MS);
    });

    recognition.onerror = (event) => this.zone.run(() => {
      const code = event?.error;
      // Silence and self-cancellation are normal here; onend does the restart.
      if (code === 'no-speech' || code === 'aborted') return;

      this.listening = false;
      this.listening$.next(false);
      const message = speechErrorMessage(code);
      if (message) this.error$.next(message);

      // A errored instance stays broken, so the retry builds a new one.
      this.recognition = null;
      this.clearRestartTimer();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.isActive && this.canRestart()) {
          this.initRecognition();
          this.startListening();
        }
      }, ERROR_RETRY_MS);
    });

    recognition.onresult = (event) => this.zone.run(() => {
      if (!this.isActive) return;
      // A warm-up session exists only to prime Chrome; whatever it heard is noise.
      if (this.warming || !this.armed) return;
      if (this.thinking || this.speaking) return;

      const result = event.results[event.results.length - 1];
      if (!result?.isFinal) return;
      const transcript = (result[0]?.transcript || '').trim();
      if (!transcript) return;

      this.transcript$.next(transcript);
    });

    this.recognition = recognition;
    return recognition;
  }

  private startListening(): void {
    if (!this.isActive) return;
    // Warm-up sessions are allowed through; anything else must pass the gate.
    if (!this.warming && this.armed && !this.canRestart()) return;

    if (!this.recognition) this.initRecognition();
    if (!this.recognition) {
      this.error$.next('Conversation Mode needs Chrome or Edge.');
      return;
    }

    if (this.listening) return;

    try {
      this.recognition.start();
      this.listening = true;
      this.listening$.next(true);
      if (this.armed && !this.warming) {
        this.status$.next(CONVERSATION_STATUS.LISTENING);
      }
    } catch (err) {
      const message = (err as { message?: string })?.message || String(err);
      if (/already started/i.test(message)) {
        this.listening = true;
        this.listening$.next(true);
        return;
      }

      this.listening = false;
      this.listening$.next(false);
      this.recognition = null;
      this.clearRestartTimer();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.isActive) {
          this.initRecognition();
          this.startListening();
        }
      }, ERROR_RETRY_MS);
    }
  }

  private finishWarmup(): void {
    if (!this.isActive || !this.warming) return;

    this.clearWarmupTimer();
    this.warming = false;
    this.armed = true;
    this.warming$.next(false);
    this.status$.next(CONVERSATION_STATUS.LISTENING);
    if (!this.listening) this.startListening();
  }

  private async enterListeningMode(): Promise<void> {
    if (!this.isActive) return;
    if (this.warming) {
      this.startListening();
      return;
    }
    if (this.thinking || this.speaking) return;

    if (!this.micStream) {
      try {
        await this.beginMicCapture();
      } catch {
        this.error$.next('Microphone access was lost. Turn Conversation Mode off and on again.');
        return;
      }
    }

    // A recognition instance reused after TTS goes deaf, especially following a
    // long reply, so every turn starts from a fresh one.
    this.disposeRecognition();
    this.initRecognition();
    this.status$.next(CONVERSATION_STATUS.LISTENING);
    this.startListening();
  }

  private disposeRecognition(): void {
    this.clearRestartTimer();
    this.listening = false;
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;

    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  // Mic capture / level meter ----------------------------------------------

  private async beginMicCapture(): Promise<MediaStream> {
    this.releaseMicCapture();
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    this.micStream = stream;
    this.stopLevelMonitor = this.startLevelMonitor(stream);
    return stream;
  }

  private releaseMicCapture(): void {
    this.stopLevelMonitor?.();
    this.stopLevelMonitor = null;

    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      this.micStream = null;
    }
    this.micLevel$.next(0);
  }

  /** Publishes a 0–100 input level so a dead or very quiet mic is visible. */
  private startLevelMonitor(stream: MediaStream): () => void {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return () => undefined;
    }

    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    const source = ctx.createMediaStreamSource(stream);
    // Boosts the meter only — Chrome's recognition gain is untouchable.
    const gain = ctx.createGain();
    gain.gain.value = 2.4;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(gain);
    gain.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let lastPublished = 0;

    // Outside the zone: a per-frame loop inside it would run change detection at 60fps.
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Quiet speech sits around 0.02–0.08, so scale it up to fill the bar.
        const level = Math.min(100, Math.round(rms * 700));

        const now = Date.now();
        if (now - lastPublished >= LEVEL_PUBLISH_MS && level !== this.micLevel$.value) {
          lastPublished = now;
          this.zone.run(() => this.micLevel$.next(level));
        }

        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      try {
        source.disconnect();
        gain.disconnect();
        analyser.disconnect();
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  }

  // Timers ------------------------------------------------------------------

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private clearWarmupTimer(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }
  }

  private clearResumeTimer(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearRestartTimer();
    this.clearWarmupTimer();
    this.clearResumeTimer();
  }
}
