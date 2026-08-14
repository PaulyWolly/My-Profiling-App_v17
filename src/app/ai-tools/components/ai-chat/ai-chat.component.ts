import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, forkJoin } from 'rxjs';

import {
  AiToolsService,
  ChatImage,
  ChatMessage,
  ChatResponse,
  ChatStreamStatus,
  MemoryFact,
  TtsVoice
} from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { environment } from '@environments/environment';
import { ChatMessageHtmlPipe } from '../../pipes/chat-message-html.pipe';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { AiChatImageDialogComponent } from './ai-chat-image-dialog.component';
import { AiChatMemoryDialogComponent } from './ai-chat-memory-dialog.component';
import { AiChatAskDialogComponent, AiChatAskResult } from './ai-chat-ask-dialog.component';
import { AiToolsHelpButtonComponent } from '../ai-tools-help/ai-tools-help-button.component';
import { SpokenStream, VoiceService } from '../../services/voice.service';
import {
  CONVERSATION_EXIT_REPLY,
  CONVERSATION_STATUS,
  ConversationService,
  isExitPhrase
} from '../../services/conversation.service';

/**
 * Deep link to the operating system's microphone page, where the input volume
 * lives. Windows and macOS each publish one; everywhere else the hint stays
 * plain text because there is nothing to open.
 */
function resolveMicSettingsUri(): string | null {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Windows/i.test(agent)) {
    // Documented by Microsoft as "Default microphone" (Windows 10 1809+).
    return 'ms-settings:sound-defaultinputproperties';
  }
  if (/Macintosh|Mac OS X/i.test(agent)) {
    return 'x-apple.systempreferences:com.apple.preference.sound?input';
  }
  return null;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    ChatMessageHtmlPipe,
    AiToolsHelpButtonComponent
  ],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit, OnDestroy {
  @ViewChild('chatLog') chatLog?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  memoryFacts: MemoryFact[] = [];
  loading = false;
  loadingHistory = true;
  configured = false;
  /** Server's upload ceiling, so the composer can refuse before uploading. */
  imageMaxMb = 50;
  /** Previews of attached pictures, held so they can be released on the way out. */
  private attachmentUrls: string[] = [];

  // Streaming ---------------------------------------------------------------
  /** The reply being written, held apart from `messages` until it is complete. */
  streamingReply: ChatMessage | null = null;
  streamStatus: ChatStreamStatus | null = null;
  private scrollQueued = false;

  // Voice -------------------------------------------------------------------
  speaking = false;
  voices: TtsVoice[] = [];
  selectedVoice = '';
  /** Null on platforms with no settings page we can open. */
  readonly micSettingsUri = resolveMicSettingsUri();
  private voiceSubs = new Subscription();

  // Conversation Mode -------------------------------------------------------
  conversationMode = false;
  conversationSupported = false;
  convWarming = false;
  convListening = false;
  micLevel = 0;

  constructor(
    private ai: AiToolsService,
    private alert: AlertService,
    private dialog: MatDialog,
    private voice: VoiceService,
    private conversation: ConversationService
  ) {}

  get memoryFactCount(): number {
    return this.memoryFacts.length;
  }

  get memoryFactValues(): string[] {
    return this.memoryFacts.map((f) => f.value).filter((v) => !!v?.trim());
  }

  get selectedVoiceLabel(): string {
    return this.voices.find((v) => v.id === this.selectedVoice)?.label || 'Voice';
  }

  ngOnInit(): void {
    this.setupVoice();
    this.setupConversation();

    forkJoin({
      status: this.ai.getStatus(),
      conversation: this.ai.getConversation(),
      memory: this.ai.getMemory()
    }).subscribe({
      next: ({ status, conversation, memory }) => {
        this.configured = status.configured;
        this.voices = status.ttsVoices || [];
        this.imageMaxMb = status.imageUploadMaxMb || this.imageMaxMb;

        // A voice saved under a different provider (e.g. OpenAI's "nova" when the
        // server now speaks through Azure) no longer exists, so it is replaced
        // with the server's default rather than sent and rejected.
        const saved = this.voice.savedVoice;
        const savedExists = !!saved && this.voices.some((v) => v.id === saved);
        this.selectedVoice = savedExists
          ? saved
          : (status.ttsDefaultVoice || this.voices[0]?.id || '');
        if (!savedExists && this.selectedVoice) {
          this.voice.saveVoice(this.selectedVoice);
        }
        this.messages = (conversation.messages || [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => this.normalizeMessage(m));
        this.memoryFacts = memory.facts || [];
        this.loadingHistory = false;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: () => {
        this.configured = false;
        this.loadingHistory = false;
      }
    });
  }

  /** Opens the composer; questions are typed there rather than in a fixed row. */
  openAsk(): void {
    if (this.loading) {
      return;
    }

    const dialogRef = this.dialog.open(AiChatAskDialogComponent, {
      maxWidth: '92vw',
      panelClass: 'ai-chat-ask-panel',
      data: { imageMaxMb: this.imageMaxMb }
    });

    dialogRef.afterClosed().subscribe((result?: AiChatAskResult) => {
      const text = (result?.text || '').trim();
      if (result?.file) {
        this.sendWithImage(text, result.file);
      } else if (text) {
        this.sendText(text, false);
      }
    });
  }

  /**
   * A turn carrying a picture. It cannot stream — the vision model answers in
   * one piece — so this is a plain request rather than the usual stream, and
   * the picture is shown in the user's own bubble the way it was sent.
   */
  private sendWithImage(text: string, file: File): void {
    if (this.loading) {
      return;
    }

    // The component owns this URL, not the composer, so it survives the dialog
    // closing and lives as long as the transcript does.
    const attachmentUrl = URL.createObjectURL(file);
    this.attachmentUrls.push(attachmentUrl);

    this.messages.push({
      role: 'user',
      // History needs words to hold onto; the bubble shows only the picture.
      content: text || '[sent a picture]',
      displayContent: text,
      attachmentUrl
    });
    this.loading = true;
    this.conversation.setThinking(true);
    this.conversation.pauseForTurn();
    this.conversation.setStatus(CONVERSATION_STATUS.THINKING);
    this.scrollToBottom();

    const payload = this.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    this.ai.chatWithImage(payload, file).subscribe({
      next: (res) => void this.onReply(res, null),
      error: (err) => this.failReply(err)
    });
  }

  // Voice -------------------------------------------------------------------

  private setupVoice(): void {
    this.voiceSubs.add(this.voice.speaking$.subscribe((v) => { this.speaking = v; }));
    // Voice/mic guidance toasts are for local debugging only — never on production.
    if (!environment.production) {
      this.voiceSubs.add(this.voice.error$.subscribe((message) => this.alert.error(message)));
    }
  }

  // Conversation Mode -------------------------------------------------------

  private setupConversation(): void {
    this.conversationSupported = this.conversation.supported;

    // Driven by the service so a denied mic permission un-checks the box itself.
    this.voiceSubs.add(this.conversation.active$.subscribe((v) => { this.conversationMode = v; }));
    this.voiceSubs.add(this.conversation.warming$.subscribe((v) => { this.convWarming = v; }));
    this.voiceSubs.add(this.conversation.listening$.subscribe((v) => { this.convListening = v; }));
    this.voiceSubs.add(this.conversation.micLevel$.subscribe((v) => { this.micLevel = v; }));
    if (!environment.production) {
      this.voiceSubs.add(this.conversation.error$.subscribe((message) => this.alert.error(message)));
    }

    this.voiceSubs.add(this.conversation.transcript$.subscribe((text) => this.onSpokenTurn(text)));
  }

  onConversationModeChange(enabled: boolean): void {
    if (enabled) {
      // Checkbox click is a user gesture — unlock TTS before the first reply speaks.
      this.voice.unlockPlayback();
      // A reply still playing would be heard by the mic as it opens.
      this.voice.stopSpeaking();
    }
    void this.conversation.setEnabled(enabled);
  }

  /** A completed utterance heard while Conversation Mode is armed. */
  private onSpokenTurn(text: string): void {
    if (this.loading) return;
    this.sendText(text, true);
  }

  get micLevelLow(): boolean {
    return this.showMicLevel && this.micLevel > 0 && this.micLevel < 12;
  }

  /** Hidden during warm-up and while the AI holds the turn. */
  get showMicLevel(): boolean {
    return this.conversationMode && !this.convWarming && !this.speaking && !this.loading;
  }

  get showListeningBadge(): boolean {
    return this.conversationMode && this.convListening && !this.convWarming && !this.speaking && !this.loading;
  }

  onVoiceChange(id: string): void {
    this.selectedVoice = id;
    this.voice.saveVoice(id);
  }

  speakMessage(msg: ChatMessage): void {
    const text = this.assistantText(msg);
    if (!text) return;
    this.voice.speak(text, this.selectedVoice);
  }

  stopSpeaking(): void {
    this.voice.stopSpeaking();
  }

  ngOnDestroy(): void {
    this.voiceSubs.unsubscribe();
    void this.conversation.setEnabled(false);
    this.voice.stopSpeaking();
    for (const url of this.attachmentUrls) {
      URL.revokeObjectURL(url);
    }
  }

  private sendText(text: string, fromVoice: boolean): void {
    if (!text || this.loading) {
      return;
    }

    if (this.conversationMode && isExitPhrase(text)) {
      this.messages.push({ role: 'user', content: text });
      this.scrollToBottom();
      void this.endConversation();
      return;
    }

    this.messages.push({ role: 'user', content: text });
    this.loading = true;
    // The mic must not hear the reply being composed or spoken.
    this.conversation.setThinking(true);
    this.conversation.pauseForTurn();
    this.conversation.setStatus(CONVERSATION_STATUS.THINKING);
    this.scrollToBottom();

    // Only send role/content to the API
    const payload = this.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    let streamed = '';
    let images: ChatImage[] = [];
    let imageQuery = '';

    // Speech is fed as the reply is written, so a long answer starts playing on
    // its first sentence instead of after the last one.
    const spoken = (this.conversationMode || fromVoice)
      ? this.voice.speakStream(this.selectedVoice)
      : null;
    if (spoken) {
      this.conversation.setSpeaking(true);
      this.conversation.setStatus(CONVERSATION_STATUS.SPEAKING);
    }

    this.ai.chatStream(payload).subscribe({
      next: (event) => {
        switch (event.type) {
          case 'status':
            this.streamStatus = event.value;
            break;

          case 'delta':
            streamed += event.value;
            spoken?.push(event.value);
            // Image markdown is only split out once the reply is whole, so the
            // text shown while streaming is the raw reply.
            this.streamingReply = { role: 'assistant', content: streamed, displayContent: streamed };
            this.streamStatus = 'writing';
            this.scrollToBottom();
            break;

          case 'rewrite':
            streamed = event.value || streamed;
            this.streamingReply = { role: 'assistant', content: streamed, displayContent: streamed };
            this.scrollToBottom();
            break;

          case 'images':
            images = (event.value || []).slice(0, 8);
            imageQuery = event.query || '';
            break;

          case 'done':
            this.finishReply(event.reply || streamed, images, event.memoryFactCount, spoken, imageQuery);
            break;

          case 'error':
            this.failReply(event.message);
            break;
        }
      },
      error: (err) => this.failReply(err),
      complete: () => {
        // A stream that ends without a done event still has to release the UI.
        if (this.loading) {
          if (streamed) {
            this.finishReply(streamed, images, undefined, spoken, imageQuery);
          } else {
            this.failReply('The reply ended unexpectedly. Please try again.');
          }
        }
      }
    });
  }

  /** Says what the reply is waiting on; a web search can take a while. */
  get waitingLabel(): string {
    if (this.streamStatus === 'searching') return 'Searching the web…';
    if (this.streamStatus === 'images') return 'Finding images…';
    return 'Thinking…';
  }

  private failReply(err: unknown): void {
    this.alert.error(err);
    this.streamingReply = null;
    this.streamStatus = null;
    this.loading = false;
    this.conversation.setThinking(false);
    // Drops any half-spoken reply and releases whoever is awaiting it.
    this.voice.stopSpeaking();
    this.conversation.setSpeaking(false);
    this.scrollToBottom();
    if (this.conversationMode) {
      this.conversation.setStatus(CONVERSATION_STATUS.ERROR);
      this.conversation.resumeAfterTurn(450);
    }
  }

  private finishReply(
    reply: string,
    images: ChatImage[],
    memoryFactCount: number | undefined,
    spoken: SpokenStream | null,
    imageQuery = ''
  ): void {
    this.streamingReply = null;
    this.streamStatus = null;
    void this.onReply({ reply, images, memoryFactCount, imageQuery }, spoken);
  }

  private async onReply(res: ChatResponse, spoken: SpokenStream | null): Promise<void> {
    const images = (res.images || []).slice(0, 8);
    const normalized = this.normalizeMessage({
      role: 'assistant',
      content: res.reply,
      images,
      imageQuery: res.imageQuery || ''
    });
    this.messages.push(normalized);

    if (typeof res.memoryFactCount === 'number') {
      this.ai.getMemory().subscribe({
        next: (m) => { this.memoryFacts = m.facts || []; },
        error: () => { /* keep previous */ }
      });
    }

    this.loading = false;
    this.conversation.setThinking(false);
    this.scrollToBottom();

    // The reply has been feeding the speaker as it arrived; this waits for the
    // audio still queued so the mic does not re-open over it.
    if (spoken) {
      await spoken.end();
      this.conversation.setSpeaking(false);
    }

    if (this.conversationMode) {
      this.conversation.resumeAfterTurn();
    }
  }

  /** Says goodbye, then drops out of Conversation Mode. */
  private async endConversation(): Promise<void> {
    this.loading = false;
    this.conversation.setThinking(false);
    await this.conversation.setEnabled(false);

    this.messages.push({ role: 'assistant', content: CONVERSATION_EXIT_REPLY });
    this.scrollToBottom();
    await this.voice.speakAndWait(CONVERSATION_EXIT_REPLY, this.selectedVoice);
  }

  /**
   * Another page of pictures, appended below the ones already there.
   *
   * Deliberately does not scroll: the reader is looking at the grid, and
   * sending them back to the top of the reply would mean scrolling down again
   * to see what they just asked for. Nothing above the new thumbnails changes
   * height, so leaving the scroll position alone keeps the view still.
   */
  loadMoreImages(msg: ChatMessage, event: Event): void {
    if (!msg.imageQuery || msg.imagesLoading || msg.imagesExhausted) {
      return;
    }

    msg.imagesLoading = true;
    const shown = (msg.images || []).map((img) => img.url).filter(Boolean);
    const grid = (event.currentTarget as HTMLElement)
      ?.closest('.chat-images')
      ?.querySelector('.chat-image-grid') as HTMLElement | null;

    this.ai.moreImages(msg.imageQuery, shown).subscribe({
      next: (res) => {
        const before = (msg.images || []).length;
        const fresh = this.dedupeImages([...(msg.images || []), ...(res.images || [])]);
        msg.imagesExhausted = fresh.length === before;
        msg.images = fresh;
        msg.imagesLoading = false;
        if (fresh.length > before) {
          this.revealImage(grid, before);
        }
      },
      error: () => {
        msg.imagesLoading = false;
        msg.imagesExhausted = true;
      }
    });
  }

  /**
   * Brings the first of the new thumbnails into view, and only if it landed
   * below the fold. "nearest" moves by the smallest amount that works, so a
   * grid already in view does not move at all.
   */
  private revealImage(grid: HTMLElement | null, index: number): void {
    if (!grid) return;
    setTimeout(() => {
      (grid.children[index] as HTMLElement | undefined)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  }

  /** Keeps existing thumbnails in place when more are appended. */
  trackImage(_index: number, image: ChatImage): string {
    return image.url;
  }

  openImage(images: ChatImage[], image: ChatImage): void {
    const list = (images || []).filter((img) => !!img?.url);
    const startIndex = Math.max(0, list.findIndex((img) => img.url === image.url));
    this.dialog.open(AiChatImageDialogComponent, {
      data: { images: list, startIndex: startIndex < 0 ? 0 : startIndex },
      maxWidth: '94vw',
      panelClass: 'ai-chat-image-lightbox-panel',
      disableClose: true
    });
  }

  clearChat(): void {
    if (this.loading) {
      return;
    }

    // Wiping the transcript mid-conversation would leave the mic talking to nothing.
    void this.conversation.setEnabled(false);
    this.voice.stopSpeaking();

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Clear chat?',
        message: 'Clear this chat transcript? Your long-term memory facts will be kept.',
        confirmText: 'Clear chat',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.ai.clearConversation().subscribe({
        next: () => {
          this.messages = [];
        },
        error: (err) => this.alert.error(err)
      });
    });
  }

  forgetMe(): void {
    if (this.loading) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Forget me?',
        message: 'Forget all remembered details about you (name, hobbies, secrets, etc.)? Chat history will stay unless you Clear chat.',
        confirmText: 'Forget me',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.ai.clearMemory().subscribe({
        next: () => {
          this.memoryFacts = [];
        },
        error: (err) => this.alert.error(err)
      });
    });
  }

  /**
   * Hands the URI to the browser rather than using an href, because Angular's
   * sanitizer rewrites schemes it does not recognize. The browser asks the user
   * before handing off to the system, so nothing opens without consent.
   */
  openMicSettings(): void {
    if (this.micSettingsUri) {
      window.location.href = this.micSettingsUri;
    }
  }

  openMemory(): void {
    // The server extracts new facts just after sending the reply, so the cached
    // list can be a moment behind. Re-read before showing it.
    this.ai.getMemory().subscribe({
      next: (m) => { this.memoryFacts = m.facts || []; this.showMemoryDialog(); },
      error: () => this.showMemoryDialog()
    });
  }

  private showMemoryDialog(): void {
    const dialogRef = this.dialog.open(AiChatMemoryDialogComponent, {
      data: { facts: this.memoryFacts },
      maxWidth: '92vw',
      panelClass: 'ai-chat-memory-panel',
      autoFocus: false,
      // The dialog reports its surviving facts however it is dismissed.
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((facts: MemoryFact[] | undefined) => {
      if (Array.isArray(facts)) {
        this.memoryFacts = facts;
      }
    });
  }

  assistantText(msg: ChatMessage): string {
    return msg.displayContent ?? msg.content;
  }

  /** Empty when a picture was sent with no words of its own. */
  userText(msg: ChatMessage): string {
    return msg.displayContent ?? msg.content;
  }

  /**
   * Split stored markdown images into a gallery + clean text body.
   */
  private normalizeMessage(msg: ChatMessage): ChatMessage {
    if (msg.role !== 'assistant') {
      return { ...msg };
    }

    const fromApi = (msg.images || []).filter((img) => !!img?.url);
    const parsed = this.extractMarkdownImages(msg.content || '');
    // Prefer API images; only use parsed markdown images that look like our gallery block
    const images = this.dedupeImages([
      ...fromApi,
      ...(fromApi.length ? [] : parsed.images)
    ]).slice(0, 8);

    return {
      ...msg,
      displayContent: parsed.text,
      images,
      // A turn reloaded from history has no query of its own, so it comes back
      // out of the saved gallery heading — otherwise "more images" would
      // disappear from every reply after a refresh.
      imageQuery: msg.imageQuery || parsed.query
    };
  }

  private extractMarkdownImages(content: string): { text: string; images: ChatImage[]; query: string } {
    const images: ChatImage[] = [];
    let text = String(content || '');
    const heading = text.match(/\*\*Images\*\*\s*for\s*[“"']([^”"'\n]+)[”"']/i);

    text = text.replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)[ \t]*\n?(?:\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|_([^_\n]+)_)?[ \t]*/g,
      (_full, alt: string, url: string, linkLabel?: string, linkUrl?: string, emSource?: string) => {
        images.push({
          url,
          title: (alt || '').trim() || undefined,
          source: (linkLabel || emSource || '').trim() || undefined,
          pageUrl: linkUrl || undefined
        });
        return '';
      }
    );

    text = text
      .replace(/\*\*Images\*\*[^\n]*\n*/gi, '')
      .replace(/^\s*#{0,3}\s*\*{0,2}(?:images?|image options|photos?|pictures?|gallery)\*{0,2}\s*$/gim, '')
      .replace(
        /(?:^|\n)[^\n]*(?:can(?:not|'t)|\bunable to\b|\bnot able to\b)\s+(?:display|show|embed|render|include)\s+images?[^\n]*/gi,
        ''
      )
      .replace(/(?:^|\n)[^\n]*here are (?:some )?(?:image|photo|picture) options[^\n]*/gi, '')
      .replace(
        /(?:^|\n)[^\n]*if you(?:'d| would) like[^\n]*(?:images?|photos?|pictures?|galler(?:y|ies))[^\n]*/gi,
        ''
      )
      .replace(
        /(?:^|\n)[^\n]*i can (?:fetch|pull|compile|provide|search for|look up|find|show)[^\n]*(?:images?|photos?|pictures?|galler(?:y|ies))[^\n]*/gi,
        ''
      )
      .replace(/[^.!?\n]*(?:and )?i can fetch a gallery of images[^.!?\n]*[.!?]?/gi, '')
      .replace(
        /^\s*(?:\d+[.)]|[-*])\s+[^\n]*(?:https?:\/\/|example image|wikimedia commons|flickr|source:\s)/gim,
        ''
      )
      .replace(/https?:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org|(?:[\w.-]+\.)?staticflickr\.com)\S*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text, images, query: (heading?.[1] || '').trim() };
  }

  private dedupeImages(images: ChatImage[]): ChatImage[] {
    const seen = new Set<string>();
    const out: ChatImage[] = [];
    for (const img of images) {
      const key = String(img.url || '').split('?')[0].toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(img);
    }
    return out;
  }

  private scrollToBottom(): void {
    // Streaming calls this once per token, so bursts collapse into one scroll.
    if (this.scrollQueued) {
      return;
    }
    this.scrollQueued = true;

    setTimeout(() => {
      this.scrollQueued = false;
      const el = this.chatLog?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
