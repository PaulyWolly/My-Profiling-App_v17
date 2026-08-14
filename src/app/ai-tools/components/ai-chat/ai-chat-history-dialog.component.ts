import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiToolsService, ChatConversationSummary } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';

export interface ChatHistoryDialogData {
  conversations: ChatConversationSummary[];
  activeId: string;
}

export interface ChatHistoryDialogResult {
  action: 'open' | 'new' | 'deleted';
  id?: string;
  conversations?: ChatConversationSummary[];
}

@Component({
  selector: 'app-ai-chat-history-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="history-dialog">
      <div class="history-dialog-header">
        <div class="history-dialog-heading">
          <h2 class="history-dialog-title">Conversation history</h2>
          <span class="history-dialog-count" *ngIf="conversations.length">
            {{ conversations.length }} saved chat{{ conversations.length === 1 ? '' : 's' }}
          </span>
        </div>
        <button mat-icon-button type="button" aria-label="Close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="history-dialog-body">
        <p class="history-dialog-empty" *ngIf="!conversations.length">
          No saved chats yet. Ask a question and it will appear here so you can come back to it later.
        </p>

        <button
          type="button"
          class="history-item"
          *ngFor="let convo of conversations"
          [class.is-active]="convo.id === activeId"
          (click)="open(convo.id)">
          <div class="history-item-text">
            <strong>{{ convo.title || 'New chat' }}</strong>
            <span class="history-item-preview" *ngIf="convo.preview">{{ convo.preview }}</span>
            <span class="history-item-date" *ngIf="convo.updated">{{ convo.updated | date:'short' }}</span>
          </div>
          <button
            mat-icon-button
            type="button"
            class="history-item-remove"
            [disabled]="removing === convo.id"
            (click)="remove($event, convo.id)"
            matTooltip="Delete this chat"
            [attr.aria-label]="'Delete ' + (convo.title || 'chat')">
            <mat-icon>delete</mat-icon>
          </button>
        </button>
      </div>

      <div class="history-dialog-footer">
        <button mat-stroked-button type="button" (click)="startNew()">
          <mat-icon>add</mat-icon>
          New chat
        </button>
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .history-dialog {
      display: flex;
      flex-direction: column;
      width: min(92vw, 640px);
      max-height: 82vh;
      background: #fff;
    }
    .history-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem 0.65rem 1.25rem;
      background: #eaf4fb;
      border-bottom: 1px solid #d5e6f2;
      flex-shrink: 0;
    }
    .history-dialog-heading {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .history-dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
    }
    .history-dialog-count {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1b5e20;
    }
    .history-dialog-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem 0.5rem 0.5rem 0.75rem;
    }
    .history-dialog-empty {
      margin: 1.5rem 1rem;
      text-align: center;
      color: #777;
      font-style: italic;
      line-height: 1.5;
    }
    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      padding: 0.55rem 0.4rem 0.55rem 0.65rem;
      border: 0;
      border-bottom: 1px solid #eef3f7;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .history-item:hover {
      background: #f4f9fc;
    }
    .history-item.is-active {
      background: #e3f2fd;
    }
    .history-item-text {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .history-item-text strong {
      font-size: 0.95rem;
      color: #1a1a1a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .history-item-preview,
    .history-item-date {
      font-size: 0.78rem;
      color: #667;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .history-item-remove {
      flex-shrink: 0;
      color: #c62828;
    }
    .history-dialog-footer {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: #f7fafc;
      border-top: 1px solid #e5eef5;
    }
  `]
})
export class AiChatHistoryDialogComponent {
  conversations: ChatConversationSummary[];
  activeId: string;
  removing: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<AiChatHistoryDialogComponent, ChatHistoryDialogResult>,
    private ai: AiToolsService,
    private alert: AlertService,
    @Inject(MAT_DIALOG_DATA) data: ChatHistoryDialogData
  ) {
    this.conversations = [...(data?.conversations || [])];
    this.activeId = data?.activeId || '';
  }

  open(id: string): void {
    this.dialogRef.close({ action: 'open', id });
  }

  startNew(): void {
    this.dialogRef.close({ action: 'new' });
  }

  remove(event: Event, id: string): void {
    event.stopPropagation();
    if (this.removing) return;
    this.removing = id;
    this.ai.deleteConversation(id).subscribe({
      next: () => {
        this.conversations = this.conversations.filter((c) => c.id !== id);
        this.removing = null;
        const wasActive = id === this.activeId;
        if (wasActive) {
          this.activeId = '';
          this.dialogRef.close({
            action: 'deleted',
            id,
            conversations: this.conversations
          });
        }
      },
      error: (err) => {
        this.alert.error(err);
        this.removing = null;
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
