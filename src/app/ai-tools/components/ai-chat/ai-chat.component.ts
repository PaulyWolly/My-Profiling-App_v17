import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';

import { AiToolsService, ChatImage, ChatMessage, MemoryFact } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { ChatMessageHtmlPipe } from '../../pipes/chat-message-html.pipe';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { AiChatImageDialogComponent } from './ai-chat-image-dialog.component';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, ChatMessageHtmlPipe],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit {
  readonly disclaimer =
    'Ask me anything. Say “image” or “images” (e.g. “tell me about the blue-ringed octopus and show me images”) and I’ll show up to 8 photo thumbnails from Wikipedia / Wikimedia Commons. Chat history and personal details are saved per login.';

  @ViewChild('chatLog') chatLog?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  memoryFacts: MemoryFact[] = [];
  input = '';
  loading = false;
  loadingHistory = true;
  configured = false;
  showMemory = false;

  constructor(
    private ai: AiToolsService,
    private alert: AlertService,
    private dialog: MatDialog
  ) {}

  get memoryFactCount(): number {
    return this.memoryFacts.length;
  }

  get memoryFactValues(): string[] {
    return this.memoryFacts.map((f) => f.value).filter((v) => !!v?.trim());
  }

  ngOnInit(): void {
    forkJoin({
      status: this.ai.getStatus(),
      conversation: this.ai.getConversation(),
      memory: this.ai.getMemory()
    }).subscribe({
      next: ({ status, conversation, memory }) => {
        this.configured = status.configured;
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

  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) {
      return;
    }
    keyEvent.preventDefault();
    this.send();
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.loading) {
      return;
    }

    this.messages.push({ role: 'user', content: text });
    this.input = '';
    this.loading = true;
    this.scrollToBottom();

    // Only send role/content to the API
    const payload = this.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    this.ai.chat(payload).subscribe({
      next: (res) => {
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
        this.scrollToBottom();
      },
      error: (err) => {
        this.alert.error(err);
        this.loading = false;
        this.scrollToBottom();
      }
    });
  }

  openImage(image: ChatImage): void {
    this.dialog.open(AiChatImageDialogComponent, {
      data: image,
      maxWidth: '94vw',
      panelClass: 'ai-chat-image-lightbox-panel'
    });
  }

  clearChat(): void {
    if (this.loading) {
      return;
    }

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
          this.input = '';
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
          this.showMemory = false;
        },
        error: (err) => this.alert.error(err)
      });
    });
  }

  removeFact(key: string): void {
    this.ai.deleteMemoryFact(key).subscribe({
      next: (res) => { this.memoryFacts = res.facts || []; },
      error: (err) => this.alert.error(err)
    });
  }

  toggleMemory(): void {
    this.showMemory = !this.showMemory;
  }

  factLabel(key: string): string {
    return key.replace(/_/g, ' ');
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
    const images = this.dedupeImages([...fromApi, ...parsed.images]).slice(0, 8);

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
    setTimeout(() => {
      const el = this.chatLog?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
