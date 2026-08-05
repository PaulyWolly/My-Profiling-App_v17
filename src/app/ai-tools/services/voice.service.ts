import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { environment } from '@environments/environment';
import { nextSpeechChunk } from './speech-chunker';

const baseUrl = `${environment.apiUrl}/api/ai`;

const VOICE_STORAGE_KEY = 'ai-tools-tts-voice';

/** How far ahead of playback to synthesize. See topUp(). */
const SPEECH_PREFETCH = 2;

/** Feeds a reply to the speaker as it is written. */
export interface SpokenStream {
  /** Adds newly generated text. */
  push(text: string): void;
  /** No more text; resolves once everything queued has finished playing. */
  end(): Promise<void>;
}

interface StreamState {
  generation: number;
  voice: string;
  startedAt: number;
  debug: boolean;
  /** Text received but not yet cut into a speakable piece. */
  buffer: string;
  /** Pieces cut but not yet sent for synthesis. */
  pending: string[];
  /** Synthesis in flight or ready to play, capped at SPEECH_PREFETCH. */
  queue: Promise<Blob | null>[];
  /** How many pieces have been queued, used to size the first one. */
  spoken: number;
  ended: boolean;
  draining: boolean;
  resolve: (() => void) | null;
}

/**
 * Speech recognition lives behind a vendor prefix in Chrome and is absent in Firefox
 * and Safari, so it is resolved at runtime rather than through a typed global.
 */
export interface SpeechAlternativeLike {
  transcript?: string;
}

export interface SpeechResultLike {
  isFinal?: boolean;
  readonly [index: number]: SpeechAlternativeLike;
}

export interface SpeechResultListLike {
  length: number;
  readonly [index: number]: SpeechResultLike;
}

export interface SpeechRecognitionEventLike {
  results: SpeechResultListLike;
  resultIndex: number;
}

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

export function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as (new () => SpeechRecognitionLike) | null;
}

/** Maps recognition error codes to something a user can actually act on. */
export function speechErrorMessage(code?: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow the mic for this site in your browser settings, then try again.';
    case 'no-speech':
      return '';
    case 'aborted':
      return '';
    case 'audio-capture':
      return 'No microphone was found. Check your system sound settings and default input device.';
    case 'network':
      return 'Speech recognition needs internet access. Check your network, VPN, or firewall, then try again.';
    default:
      return code ? `Microphone error: ${code}` : 'Microphone error.';
  }
}

@Injectable({ providedIn: 'root' })
export class VoiceService {
  /** True while the mic is actively listening. */
  readonly listening$ = new BehaviorSubject<boolean>(false);
  /** True while TTS audio is downloading or playing. */
  readonly speaking$ = new BehaviorSubject<boolean>(false);
  /** Emits the final transcript for a completed listen. */
  readonly transcript$ = new Subject<string>();
  /** Emits partial text while the user is still talking. */
  readonly interim$ = new Subject<string>();
  readonly error$ = new Subject<string>();

  private recognition: SpeechRecognitionLike | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private stream: StreamState | null = null;
  /** Bumped on every speak/stop so a slow request can't start playing after a stop. */
  private speakGeneration = 0;
  private pendingSpeakDone: (() => void) | null = null;

  constructor(private http: HttpClient, private zone: NgZone) {}

  // Speech recognition ------------------------------------------------------

  get recognitionSupported(): boolean {
    return !!getRecognitionCtor();
  }

  get isListening(): boolean {
    return this.listening$.value;
  }

  startListening(lang = 'en-US'): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.error$.next('Voice input needs Chrome or Edge with microphone permission.');
      return;
    }

    this.stopListening();

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      this.error$.next('Could not start the microphone.');
      return;
    }

    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Recognition callbacks fire outside Angular's zone, so state changes are
    // marshalled back in or the UI won't update until the next unrelated event.
    recognition.onstart = () => this.zone.run(() => this.listening$.next(true));

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      this.zone.run(() => {
        if (interimText.trim()) this.interim$.next(interimText.trim());
        if (finalText.trim()) this.transcript$.next(finalText.trim());
      });
    };

    recognition.onerror = (event) => {
      const message = speechErrorMessage(event?.error);
      this.zone.run(() => {
        this.listening$.next(false);
        if (message) this.error$.next(message);
      });
    };

    recognition.onend = () => {
      this.recognition = null;
      this.zone.run(() => this.listening$.next(false));
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.recognition = null;
      this.listening$.next(false);
      this.error$.next('Could not start the microphone.');
    }
  }

  stopListening(): void {
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
    this.listening$.next(false);
  }

  toggleListening(lang = 'en-US'): void {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening(lang);
    }
  }

  // Text to speech ----------------------------------------------------------

  get isSpeaking(): boolean {
    return this.speaking$.value;
  }

  /**
   * Call from a click/tap (e.g. enabling Conversation Mode) so later TTS
   * play() calls are allowed. Browsers block unmuted audio until then.
   */
  unlockPlayback(): void {
    try {
      const audio = new Audio(
        // Tiny silent WAV — unmuted play during a gesture unlocks later clips.
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=='
      );
      void audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  speak(text: string, voice?: string): void {
    void this.speakAndWait(text, voice);
  }

  /**
   * Speaks a reply while it is still being written.
   *
   * Waiting for the whole reply means a long answer stays silent until the last
   * word has been generated and then synthesized. Instead the text is cut at
   * sentence boundaries and each piece is synthesized as soon as it exists, so
   * audio starts on the first sentence. The next piece is fetched while the
   * current one plays, which keeps the gaps between them short.
   */
  speakStream(voice?: string): SpokenStream {
    this.settleSpeak();
    this.abandonStream();
    const generation = ++this.speakGeneration;
    this.stopAudio();
    this.speaking$.next(true);

    const stream: StreamState = {
      generation,
      voice: voice || this.savedVoice,
      startedAt: Date.now(),
      debug: this.debugEnabled,
      buffer: '',
      pending: [],
      queue: [],
      spoken: 0,
      ended: false,
      draining: false,
      resolve: null
    };
    this.stream = stream;

    return {
      push: (text: string) => this.pushStreamText(stream, text),
      end: () => this.endStream(stream)
    };
  }

  private pushStreamText(stream: StreamState, text: string): void {
    if (stream.generation !== this.speakGeneration || !text) return;

    stream.buffer += text;

    let chunk = this.takeChunk(stream, false);
    while (chunk) {
      this.enqueueChunk(stream, chunk);
      chunk = this.takeChunk(stream, false);
    }
  }

  private endStream(stream: StreamState): Promise<void> {
    if (stream.generation !== this.speakGeneration) return Promise.resolve();

    stream.ended = true;
    const rest = this.takeChunk(stream, true);
    if (rest) {
      this.enqueueChunk(stream, rest);
    }

    // Nothing was ever queued, so there is no playback to wait for.
    if (!stream.queue.length && !stream.pending.length && !stream.draining) {
      if (stream.spoken === 0) this.speaking$.next(false);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      stream.resolve = resolve;
      this.drain(stream);
    });
  }

  private takeChunk(stream: StreamState, flush: boolean): string | null {
    const { chunk, rest } = nextSpeechChunk(stream.buffer, stream.spoken === 0, flush);
    stream.buffer = rest;
    return chunk;
  }

  private enqueueChunk(stream: StreamState, text: string): void {
    stream.spoken += 1;
    this.trace(stream, `piece ${stream.spoken} ready (${text.length} chars)`);

    stream.pending.push(text);
    this.topUp(stream);
    this.drain(stream);
  }

  /**
   * Starts synthesis a little ahead of playback, but no further.
   *
   * A long reply can produce a dozen pieces in a couple of seconds. Requesting
   * them all at once fills the browser's per-host connection limit, which the
   * reply stream itself is also using, so later pieces end up queued in the
   * browser instead of being fetched when they are actually needed.
   */
  private topUp(stream: StreamState): void {
    while (stream.queue.length < SPEECH_PREFETCH && stream.pending.length) {
      const text = stream.pending.shift()!;
      const index = stream.spoken - stream.pending.length;
      const audio = this.synthesize(text, stream.voice);
      void audio.then(() => this.trace(stream, `piece ${index} audio received`));
      stream.queue.push(audio);
    }
  }

  /**
   * Timing for the spoken reply, off unless it is asked for:
   *   localStorage.setItem('ai-voice-debug', '1')
   */
  private trace(stream: StreamState, message: string): void {
    if (!stream.debug) return;
    console.debug(`[voice +${Date.now() - stream.startedAt}ms] ${message}`);
  }

  private synthesize(text: string, voice: string): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      this.http
        .post(`${baseUrl}/tts`, { text, voice }, { responseType: 'blob' })
        .subscribe({
          next: (blob) => resolve(blob),
          error: (err) => {
            this.zone.run(() => this.error$.next(this.readError(err)));
            resolve(null);
          }
        });
    });
  }

  /** Plays queued pieces in order, one at a time. */
  private async drain(stream: StreamState): Promise<void> {
    if (stream.draining || stream.generation !== this.speakGeneration) return;
    stream.draining = true;

    let index = 0;
    while (stream.queue.length) {
      index += 1;
      const blob = await stream.queue.shift()!;
      // Fetch the next piece now so it is ready when this one ends.
      this.topUp(stream);

      if (stream.generation !== this.speakGeneration) break;
      if (blob) {
        this.trace(stream, `playing piece ${index}`);
        await this.playAudio(blob, stream.generation);
        this.trace(stream, `finished piece ${index}`);
      }
      if (stream.generation !== this.speakGeneration) break;
      this.topUp(stream);
    }

    stream.draining = false;

    // More text may still be on its way; only finish once the stream is closed.
    if (stream.ended && !stream.queue.length && !stream.pending.length) {
      if (stream.generation === this.speakGeneration) {
        this.speaking$.next(false);
        this.stream = null;
      }
      const done = stream.resolve;
      stream.resolve = null;
      done?.();
    }
  }

  /**
   * Same as speak() but resolves once playback has finished, been stopped, or
   * failed. Conversation Mode needs this so it only re-opens the mic after the
   * reply has actually stopped coming out of the speakers.
   *
   * Never rejects — a failed reply should not break the conversation loop.
   */
  speakAndWait(text: string, voice?: string): Promise<void> {
    const value = (text || '').trim();
    if (!value) return Promise.resolve();

    // Any earlier playback is abandoned, so let whoever awaited it continue.
    this.settleSpeak();
    this.abandonStream();

    const generation = ++this.speakGeneration;
    this.stopAudio();
    this.speaking$.next(true);

    return new Promise<void>((resolve) => {
      this.pendingSpeakDone = resolve;

      this.http
        .post(`${baseUrl}/tts`, { text: value, voice: voice || this.savedVoice }, { responseType: 'blob' })
        .subscribe({
          next: (blob) => {
            // The user may have hit Stop while the audio was still downloading.
            if (generation !== this.speakGeneration) return;
            this.playBlob(blob, generation);
          },
          error: (err) => {
            if (generation !== this.speakGeneration) return;
            this.zone.run(() => {
              this.speaking$.next(false);
              this.error$.next(this.readError(err));
              this.settleSpeak();
            });
          }
        });
    });
  }

  stopSpeaking(): void {
    this.speakGeneration += 1;
    this.stopAudio();
    this.speaking$.next(false);
    this.abandonStream();
    this.settleSpeak();
  }

  /** Releases a pending speakAndWait() promise exactly once. */
  private settleSpeak(): void {
    const done = this.pendingSpeakDone;
    this.pendingSpeakDone = null;
    done?.();
  }

  /**
   * Frees anyone awaiting a streamed reply that has been superseded or stopped.
   * Conversation Mode waits on that promise before re-opening the mic, so it
   * must resolve even when playback never finished.
   */
  private abandonStream(): void {
    const stream = this.stream;
    this.stream = null;
    if (!stream) return;

    stream.ended = true;
    stream.pending = [];
    stream.queue = [];
    const done = stream.resolve;
    stream.resolve = null;
    done?.();
  }

  private playBlob(blob: Blob, generation: number): void {
    void this.playAudio(blob, generation).then(() => {
      if (generation !== this.speakGeneration) return;
      this.speaking$.next(false);
      this.settleSpeak();
    });
  }

  /**
   * Plays a single clip. Resolves when it finishes, fails, or is superseded, so
   * a queue of clips can be played strictly in order. Never rejects.
   */
  private playAudio(blob: Blob, generation: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      this.audioUrl = url;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.zone.run(() => {
          // A newer clip may already own this.audio; only clear our own.
          if (this.audio === audio) {
            this.stopAudio();
          } else {
            URL.revokeObjectURL(url);
          }
          resolve();
        });
      };

      audio.onended = finish;
      audio.onerror = finish;

      audio.play().catch(() => {
        // Autoplay can be blocked until a recent user gesture. Do not toast —
        // production should stay quiet; unlockPlayback() covers the common case.
        finish();
      });
    });
  }

  private stopAudio(): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }

  private readError(err: unknown): string {
    const message = (err as { error?: { message?: string }; message?: string })?.error?.message
      || (err as { message?: string })?.message;
    return message || 'Could not play the spoken reply.';
  }

  // Preferences -------------------------------------------------------------

  private get debugEnabled(): boolean {
    try {
      return localStorage.getItem('ai-voice-debug') === '1';
    } catch {
      return false;
    }
  }

  get savedVoice(): string {
    try {
      return localStorage.getItem(VOICE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  saveVoice(id: string): void {
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }

  /** Convenience stream for components that only care about combined busy state. */
  get busy$(): Observable<boolean> {
    return this.speaking$.asObservable();
  }
}
