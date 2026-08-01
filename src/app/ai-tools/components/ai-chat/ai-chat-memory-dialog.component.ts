import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiToolsService, MemoryFact } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';

export interface ChatMemoryDialogData {
  facts: MemoryFact[];
}

/**
 * Shows the long-term details the assistant has saved about the signed-in user.
 * Facts are deleted from here directly and the surviving list is handed back on
 * close, so the chat page stays in step without re-fetching.
 */
@Component({
  selector: 'app-ai-chat-memory-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="memory-dialog">
      <div class="memory-dialog-header">
        <div class="memory-dialog-heading">
          <h2 class="memory-dialog-title">Details saved about you</h2>
          <span class="memory-dialog-count" *ngIf="facts.length">
            Remembering {{ facts.length }} detail{{ facts.length === 1 ? '' : 's' }}
          </span>
        </div>
        <button mat-icon-button type="button" aria-label="Close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="memory-dialog-body">
        <p class="memory-dialog-empty" *ngIf="!facts.length">
          No saved details yet — tell me your name, hobbies, or what you like and I'll remember
          it next time you log in.
        </p>

        <div class="memory-fact" *ngFor="let fact of facts">
          <div class="memory-fact-text">
            <span class="memory-cat">{{ fact.category }}</span>
            <strong>{{ factLabel(fact.key) }}</strong>: {{ fact.value }}
          </div>
          <button
            mat-icon-button
            type="button"
            class="memory-fact-remove"
            [disabled]="removing === fact.key"
            (click)="removeFact(fact.key)"
            matTooltip="Forget this detail"
            [attr.aria-label]="'Forget ' + factLabel(fact.key)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>

      <div class="memory-dialog-footer">
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .memory-dialog {
      display: flex;
      flex-direction: column;
      width: min(92vw, 640px);
      max-height: 82vh;
      background: #fff;
    }
    .memory-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem 0.65rem 1.25rem;
      background: #eaf4fb;
      border-bottom: 1px solid #d5e6f2;
      flex-shrink: 0;
    }
    .memory-dialog-heading {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .memory-dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
    }
    .memory-dialog-count {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1b5e20;
    }
    .memory-dialog-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: #64b5f6 #e8f4fc;
      padding: 0.5rem 0.5rem 0.5rem 1.25rem;
    }
    .memory-dialog-body::-webkit-scrollbar {
      width: 12px;
      -webkit-appearance: none;
    }
    .memory-dialog-body::-webkit-scrollbar-thumb {
      background: #64b5f6;
      border-radius: 6px;
      border: 2px solid #e8f4fc;
      min-height: 36px;
    }
    .memory-dialog-body::-webkit-scrollbar-thumb:hover {
      background: #42a5f5;
    }
    .memory-dialog-body::-webkit-scrollbar-track {
      background: #e8f4fc;
    }
    .memory-dialog-empty {
      margin: 1.5rem 1rem;
      text-align: center;
      color: #777;
      font-style: italic;
      line-height: 1.5;
    }
    .memory-fact {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid #eef3f7;
    }
    .memory-fact:last-child {
      border-bottom: none;
    }
    .memory-fact-text {
      font-size: 0.92rem;
      color: #333;
      line-height: 1.35;
      word-break: break-word;
    }
    .memory-cat {
      display: inline-block;
      margin-right: 0.4rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1565c0;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .memory-fact-text strong {
      font-weight: 700;
    }
    .memory-fact-remove {
      flex-shrink: 0;
      color: #c62828;
    }
    .memory-fact-remove:hover:not([disabled]) {
      background: #fdecea;
    }
    .memory-fact-remove .mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .memory-dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 0.75rem 1.25rem;
      background: #f7fafc;
      border-top: 1px solid #e5eef5;
      flex-shrink: 0;
    }
  `]
})
export class AiChatMemoryDialogComponent {
  facts: MemoryFact[];
  /** Key currently being deleted, so its button can't be double-clicked. */
  removing: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<AiChatMemoryDialogComponent>,
    private ai: AiToolsService,
    private alert: AlertService,
    @Inject(MAT_DIALOG_DATA) data: ChatMemoryDialogData
  ) {
    this.facts = [...(data?.facts || [])];

    // Opened with disableClose so that dismissing by backdrop or Escape still
    // reports the surviving facts back to the chat page.
    this.dialogRef.backdropClick().subscribe(() => this.close());
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  factLabel(key: string): string {
    return key.replace(/_/g, ' ');
  }

  removeFact(key: string): void {
    if (this.removing) {
      return;
    }
    this.removing = key;
    this.ai.deleteMemoryFact(key).subscribe({
      next: (res) => {
        this.facts = res.facts || [];
        this.removing = null;
      },
      error: (err) => {
        this.alert.error(err);
        this.removing = null;
      }
    });
  }

  close(): void {
    this.dialogRef.close(this.facts);
  }
}
