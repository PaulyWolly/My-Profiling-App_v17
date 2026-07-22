import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { forkJoin } from 'rxjs';

import { AiToolsService, ChatMessage, MemoryFact } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { ChatMessageHtmlPipe } from '../../pipes/chat-message-html.pipe';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, ChatMessageHtmlPipe],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit {
  readonly disclaimer =
    'Ask me anything. I remember details you share (name, hobbies, likes, and more) for your account. Chat uses gpt-5-nano with web search — your API key stays on the server.';

  @ViewChild('chatLog') chatLog?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  memoryFacts: MemoryFact[] = [];
  input = '';
  loading = false;
  loadingHistory = true;
  configured = false;
  showMemory = false;

  constructor(private ai: AiToolsService, private alert: AlertService) {}

  get memoryFactCount(): number {
    return this.memoryFacts.length;
  }

  ngOnInit(): void {
    forkJoin({
      status: this.ai.getStatus(),
      conversation: this.ai.getConversation(),
      memory: this.ai.getMemory()
    }).subscribe({
      next: ({ status, conversation, memory }) => {
        this.configured = status.configured;
        this.messages = (conversation.messages || []).filter(
          (m) => m.role === 'user' || m.role === 'assistant'
        );
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

    const payload = this.messages.filter((m) => m.role === 'user' || m.role === 'assistant');

    this.ai.chat(payload).subscribe({
      next: (res) => {
        this.messages.push({ role: 'assistant', content: res.reply });
        if (typeof res.memoryFactCount === 'number') {
          // Refresh facts so UI matches server memory
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

  clearChat(): void {
    if (this.loading) {
      return;
    }
    if (!confirm('Clear this chat transcript? Your long-term memory facts will be kept.')) {
      return;
    }
    this.ai.clearConversation().subscribe({
      next: () => {
        this.messages = [];
        this.input = '';
      },
      error: (err) => this.alert.error(err)
    });
  }

  forgetMe(): void {
    if (this.loading) {
      return;
    }
    if (!confirm('Forget all remembered details about you (name, hobbies, secrets, etc.)? Chat history will stay unless you Clear.')) {
      return;
    }
    this.ai.clearMemory().subscribe({
      next: () => {
        this.memoryFacts = [];
        this.showMemory = false;
      },
      error: (err) => this.alert.error(err)
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

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatLog?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
