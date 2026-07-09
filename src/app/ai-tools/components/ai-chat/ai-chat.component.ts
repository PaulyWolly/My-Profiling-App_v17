import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { AiToolsService, ChatMessage } from '../../services/ai-tools.service';
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
  readonly disclaimer = 'Ask me anything. Chat uses gpt-5-nano with web search for current events — your API key stays secure.';

  @ViewChild('chatLog') chatLog?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  input = '';
  loading = false;
  configured = false;

  constructor(private ai: AiToolsService, private alert: AlertService) {}

  ngOnInit(): void {
    this.ai.getStatus().subscribe({
      next: (s) => { this.configured = s.configured; },
      error: () => { this.configured = false; }
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
    this.messages = [];
    this.input = '';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatLog?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
