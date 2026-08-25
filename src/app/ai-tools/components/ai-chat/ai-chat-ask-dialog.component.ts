import { Component, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface AiChatAskDialogData {
  /** Upload ceiling the server enforces, so the refusal happens before the trip. */
  imageMaxMb?: number;
}

export interface AiChatAskResult {
  text: string;
  file: File | null;
}

/**
 * Roomy composer for typed questions. Chat is driven by Conversation Mode most of
 * the time, so the keyboard route lives here instead of taking up a permanent row
 * under the transcript. Closes with the question and any attached picture, or
 * undefined if cancelled.
 */
@Component({
  selector: 'app-ai-chat-ask-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="ask-dialog">
      <div class="ask-dialog-header">
        <h2 class="ask-dialog-title">Type your query</h2>
        <button mat-icon-button type="button" aria-label="Close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="ask-dialog-body">
        <div class="ask-field">
          <textarea
            cdkFocusInitial
            [(ngModel)]="text"
            rows="8"
            placeholder="Type your question… Press Enter to send, Shift+Enter for a new line."
            aria-label="Your question"
            (keydown.enter)="onEnter($event)"></textarea>

          <button
            type="button"
            class="ask-attach"
            (click)="picker.click()"
            matTooltip="Attach a picture"
            aria-label="Attach a picture">
            <mat-icon>add</mat-icon>
          </button>

          <input
            #picker
            type="file"
            class="ask-file"
            [accept]="accept"
            (change)="onFilePicked($event)" />

          <div class="ask-attachment" *ngIf="previewUrl">
            <img [src]="previewUrl" alt="Attached picture" />
            <span class="ask-attachment-name">{{ fileName }}</span>
            <button
              type="button"
              class="ask-attachment-remove"
              (click)="clearFile()"
              aria-label="Remove attached picture">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <p class="ask-dialog-error" *ngIf="error">{{ error }}</p>
        <p class="ask-dialog-hint">
          Say image, picture or photo to get up to 8 thumbnails with your answer,
          or use + to ask about a picture of your own.
        </p>
      </div>

      <div class="ask-dialog-footer">
        <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
        <button
          mat-raised-button
          color="primary"
          type="button"
          [disabled]="!canSend"
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
    /* The + and the thumbnail sit inside the field, so the space they occupy is
       kept clear at the bottom of the textarea rather than overlapping typing. */
    .ask-field {
      position: relative;
    }
    .ask-field textarea {
      padding-bottom: 3rem;
    }
    .ask-file {
      display: none;
    }
    .ask-attach {
      position: absolute;
      left: 0.5rem;
      bottom: 0.55rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid #ccd9e3;
      border-radius: 50%;
      background: #f4f9fc;
      color: #1565c0;
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }
    .ask-attach:hover,
    .ask-attach:focus-visible {
      background: #e3f2fd;
      border-color: #42a5f5;
      outline: none;
    }
    .ask-attach mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }
    .ask-attachment {
      position: absolute;
      left: 2.6rem;
      bottom: 0.55rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      max-width: calc(100% - 3.5rem);
      padding: 0.15rem 0.3rem 0.15rem 0.15rem;
      border: 1px solid #ccd9e3;
      border-radius: 6px;
      background: #fff;
    }
    .ask-attachment img {
      display: block;
      width: 26px;
      height: 26px;
      border-radius: 4px;
      object-fit: cover;
    }
    .ask-attachment-name {
      overflow: hidden;
      max-width: 14rem;
      color: #4a6b80;
      font-size: 0.75rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ask-attachment-remove {
      display: inline-flex;
      padding: 0;
      border: 0;
      background: none;
      color: #78909c;
      cursor: pointer;
    }
    .ask-attachment-remove:hover {
      color: #c62828;
    }
    .ask-attachment-remove mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }
    .ask-dialog-error {
      margin: 0.5rem 0 0;
      color: #c62828;
      font-size: 0.82rem;
      line-height: 1.4;
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
export class AiChatAskDialogComponent implements OnDestroy {
  text = '';
  file: File | null = null;
  fileName = '';
  previewUrl = '';
  error = '';

  readonly accept = 'image/png,image/jpeg,image/gif,image/webp,image/bmp';

  constructor(
    private dialogRef: MatDialogRef<AiChatAskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: AiChatAskDialogData | null
  ) {}

  /** A picture on its own is a fair question, so either half is enough. */
  get canSend(): boolean {
    return !!this.text.trim() || !!this.file;
  }

  private get maxMb(): number {
    return this.data?.imageMaxMb || 50;
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] || null;
    // Lets the same file be chosen again after being removed.
    input.value = '';

    if (!picked) {
      return;
    }
    if (!picked.type.startsWith('image/')) {
      this.error = 'That file is not a picture.';
      return;
    }
    if (picked.size > this.maxMb * 1024 * 1024) {
      this.error = `That picture is larger than ${this.maxMb} MB.`;
      return;
    }

    this.clearPreview();
    this.error = '';
    this.file = picked;
    this.fileName = picked.name;
    this.previewUrl = URL.createObjectURL(picked);
  }

  clearFile(): void {
    this.clearPreview();
    this.file = null;
    this.fileName = '';
    this.error = '';
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
    if (!this.canSend) {
      return;
    }
    this.dialogRef.close({ text: this.text.trim(), file: this.file });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.clearPreview();
  }

  /** Object URLs are held by the browser until they are handed back. */
  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }
  }
}
