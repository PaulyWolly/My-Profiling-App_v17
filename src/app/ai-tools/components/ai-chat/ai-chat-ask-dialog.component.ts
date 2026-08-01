import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Roomy composer for typed questions. Chat is driven by Conversation Mode most of
 * the time, so the keyboard route lives here instead of taking up a permanent row
 * under the transcript. Closes with the trimmed question, or undefined if cancelled.
 */
@Component({
  selector: 'app-ai-chat-ask-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="ask-dialog">
      <div class="ask-dialog-header">
        <h2 class="ask-dialog-title">Ask your query</h2>
        <button mat-icon-button type="button" aria-label="Close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="ask-dialog-body">
        <textarea
          cdkFocusInitial
          [(ngModel)]="text"
          rows="8"
          placeholder="Type your question… Press Enter to send, Shift+Enter for a new line."
          aria-label="Your question"
          (keydown.enter)="onEnter($event)"></textarea>
        <p class="ask-dialog-hint">
          Say image, picture or photo to get up to 8 thumbnails with your answer.
        </p>
      </div>

      <div class="ask-dialog-footer">
        <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
        <button
          mat-raised-button
          color="primary"
          type="button"
          [disabled]="!text.trim()"
          (click)="send()">
          Send
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ask-dialog {
      display: flex;
      flex-direction: column;
      width: min(92vw, 680px);
      background: #fff;
    }
    .ask-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem 0.65rem 1.25rem;
      background: #eaf4fb;
      border-bottom: 1px solid #d5e6f2;
    }
    .ask-dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
    }
    .ask-dialog-body {
      padding: 1rem 1.25rem 0.25rem;
    }
    .ask-dialog-body textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 9rem;
      max-height: 40vh;
      padding: 0.6rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .ask-dialog-body textarea:focus {
      outline: none;
      border-color: #42a5f5;
      box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.18);
    }
    .ask-dialog-hint {
      margin: 0.5rem 0 0;
      color: #6b8fa8;
      font-size: 0.82rem;
      line-height: 1.4;
    }
    .ask-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      margin-top: 0.75rem;
      background: #f7fafc;
      border-top: 1px solid #e5eef5;
    }
  `]
})
export class AiChatAskDialogComponent {
  text = '';

  constructor(private dialogRef: MatDialogRef<AiChatAskDialogComponent>) {}

  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) {
      return;
    }
    keyEvent.preventDefault();
    this.send();
  }

  send(): void {
    const question = this.text.trim();
    if (!question) {
      return;
    }
    this.dialogRef.close(question);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
