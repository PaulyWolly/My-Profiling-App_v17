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
import { ChatMessageHtmlPipe } from '../../pipes/chat-message-html.pipe';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { AiChatImageDialogComponent } from './ai-chat-image-dialog.component';
import { AiChatMemoryDialogComponent } from './ai-chat-memory-dialog.component';
import { AiChatAskDialogComponent } from './ai-chat-ask-dialog.component';
import { SpokenStream, VoiceService } from '../../services/voice.service';
import {
  CONVERSATION_EXIT_REPLY,
  CONVERSATION_STATUS,
  ConversationService,
  isExitPhrase
} from '../../services/conversation.service';

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
    ChatMessageHtmlPipe
  ],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit, OnDestroy {
  readonly disclaimer =
    'Ask me anything. Say image/images, picture/pictures, or photo/photos (e.g. “show me pictures of a king cobra”) and I’ll show up to 8 photo thumbnails from Wikipedia / Wikimedia Commons. Chat history and personal details are saved per login.';

  @ViewChild('chatLog') chatLog?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  memoryFacts: MemoryFact[] = [];
  loading = false;
  loadingHistory = true;
  configured = false;

  // Streaming ---------------------------------------------------------------
  /** The reply being written, held apart from `messages` until it is complete. */
  streamingReply: ChatMessage | null = null;
  streamStatus: ChatStreamStatus | null = null;
  private scrollQueued = false;

  // Voice -------------------------------------------------------------------
  speaking = false;
  voices: TtsVoice[] = [];
  selectedVoice = '';
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
      panelClass: 'ai-chat-ask-panel'
    });

    dialogRef.afterClosed().subscribe((question?: string) => {
      const text = (question || '').trim();
      if (text) {
        this.sendText(text, false);
      }
    });
  }

  // Voice -------------------------------------------------------------------

  private setupVoice(): void {
    this.voiceSubs.add(this.voice.speaking$.subscribe((v) => { this.speaking = v; }));
    this.voiceSubs.add(this.voice.error$.subscribe((message) => this.alert.error(message)));
  }

  // Conversation Mode -------------------------------------------------------

  private setupConversation(): void {
    this.conversationSupported = this.conversation.supported;

    // Driven by the service so a denied mic permission un-checks the box itself.
    this.voiceSubs.add(this.conversation.active$.subscribe((v) => { this.conversationMode = v; }));
    this.voiceSubs.add(this.conversation.warming$.subscribe((v) => { this.convWarming = v; }));
    this.voiceSubs.add(this.conversation.listening$.subscribe((v) => { this.convListening = v; }));
    this.voiceSubs.add(this.conversation.micLevel$.subscribe((v) => { this.micLevel = v; }));
    this.voiceSubs.add(this.conversation.error$.subscribe((message) => this.alert.error(message)));

    this.voiceSubs.add(this.conversation.transcript$.subscribe((text) => this.onSpokenTurn(text)));
  }

  onConversationModeChange(enabled: boolean): void {
    if (enabled) {
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

          case 'images':
            images = (event.value || []).slice(0, 8);
            break;

          case 'done':
            this.finishReply(event.reply || streamed, images, event.memoryFactCount, spoken);
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
            this.finishReply(streamed, images, undefined, spoken);
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
    spoken: SpokenStream | null
  ): void {
    this.streamingReply = null;
    this.streamStatus = null;
    void this.onReply({ reply, images, memoryFactCount }, spoken);
  }

  private async onReply(res: ChatResponse, spoken: SpokenStream | null): Promise<void> {
    const images = (res.images || []).slice(0, 8);
    const normalized = this.normalizeMessage({
      role: 'assistant',
      content: res.reply,
      images
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
      images
    };
  }

  private extractMarkdownImages(content: string): { text: string; images: ChatImage[] } {
    const images: ChatImage[] = [];
    let text = String(content || '');

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
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text, images };
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
