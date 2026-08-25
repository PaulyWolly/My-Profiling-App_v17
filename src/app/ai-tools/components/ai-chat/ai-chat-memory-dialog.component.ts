import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
 * Facts can be edited inline or deleted; the surviving list is handed back on
 * close so the chat page stays in step without re-fetching.
 */
@Component({
  selector: 'app-ai-chat-memory-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
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

        <div class="memory-fact" *ngFor="let fact of facts" [class.is-editing]="editingKey === fact.key">
          <div class="memory-fact-text">
            <span class="memory-cat">{{ fact.category }}</span>
            <strong>{{ factLabel(fact.key) }}</strong>:

            <ng-container *ngIf="editingKey !== fact.key; else editField">
              {{ fact.value }}
            </ng-container>
            <ng-template #editField>
              <input
                #editInput
                class="memory-fact-input"
                type="text"
                [(ngModel)]="draftValue"
                [disabled]="saving"
                maxlength="500"
                [attr.aria-label]="'Edit ' + factLabel(fact.key)"
                (keydown.enter)="saveEdit()"
                (keydown.escape)="$event.stopPropagation(); cancelEdit()" />
            </ng-template>
          </div>

          <div class="memory-fact-actions">
            <ng-container *ngIf="editingKey !== fact.key; else editActions">
              <button
                mat-icon-button
                type="button"
                class="memory-fact-edit"
                [disabled]="!!removing || !!editingKey"
                (click)="startEdit(fact)"
                matTooltip="Edit this detail"
                [attr.aria-label]="'Edit ' + factLabel(fact.key)">
                <mat-icon>edit</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                class="memory-fact-remove"
                [disabled]="removing === fact.key || !!editingKey"
                (click)="removeFact(fact.key)"
                matTooltip="Forget this detail"
                [attr.aria-label]="'Forget ' + factLabel(fact.key)">
                <mat-icon>delete</mat-icon>
              </button>
            </ng-container>
            <ng-template #editActions>
              <button
                mat-icon-button
                type="button"
                class="memory-fact-save"
                [disabled]="saving || !draftValue.trim()"
                (click)="saveEdit()"
                matTooltip="Save"
                aria-label="Save detail">
                <mat-icon>check</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                class="memory-fact-cancel"
                [disabled]="saving"
                (click)="cancelEdit()"
                matTooltip="Cancel"
                aria-label="Cancel edit">
                <mat-icon>close</mat-icon>
              </button>
            </ng-template>
          </div>
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
      gap: 0.5rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid #eef3f7;
    }
    .memory-fact:last-child {
      border-bottom: none;
    }
    .memory-fact.is-editing {
      background: #f7fbfe;
      margin: 0 -0.5rem 0 -0.75rem;
      padding-left: 0.75rem;
      padding-right: 0.5rem;
      border-radius: 6px;
    }
    .memory-fact-text {
      flex: 1 1 auto;
      min-width: 0;
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
    .memory-fact-input {
      display: block;
      width: 100%;
      margin-top: 0.35rem;
      box-sizing: border-box;
      padding: 0.4rem 0.55rem;
      border: 1px solid #90caf9;
      border-radius: 6px;
      font: inherit;
      color: #1a1a1a;
      background: #fff;
    }
    .memory-fact-input:focus {
      outline: 2px solid #1976d2;
      outline-offset: 1px;
    }
    .memory-fact-actions {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 0.1rem;
    }
    .memory-fact-edit {
      color: #1565c0;
    }
    .memory-fact-edit:hover:not([disabled]) {
      background: #e3f2fd;
    }
    .memory-fact-save {
      color: #2e7d32;
    }
    .memory-fact-save:hover:not([disabled]) {
      background: #e8f5e9;
    }
    .memory-fact-cancel {
      color: #546e7a;
    }
    .memory-fact-remove {
      color: #c62828;
    }
    .memory-fact-remove:hover:not([disabled]) {
      background: #fdecea;
    }
    .memory-fact-actions .mat-icon {
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
  @ViewChild('editInput') editInput?: ElementRef<HTMLInputElement>;

  facts: MemoryFact[];
  /** Key currently being deleted, so its button can't be double-clicked. */
  removing: string | null = null;
  editingKey: string | null = null;
  draftValue = '';
  saving = false;

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
        if (this.editingKey) {
          event.stopPropagation();
          this.cancelEdit();
          return;
        }
        this.close();
      }
    });
  }

  factLabel(key: string): string {
    return key.replace(/_/g, ' ');
  }

  startEdit(fact: MemoryFact): void {
    if (this.removing || this.saving) {
      return;
    }
    this.editingKey = fact.key;
    this.draftValue = fact.value;
    setTimeout(() => {
      const input = this.editInput?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  cancelEdit(): void {
    if (this.saving) {
      return;
    }
    this.editingKey = null;
    this.draftValue = '';
  }

  saveEdit(): void {
    const key = this.editingKey;
    const value = this.draftValue.trim();
    if (!key || !value || this.saving) {
      return;
    }

    const current = this.facts.find((f) => f.key === key);
    if (current && current.value === value) {
      this.cancelEdit();
      return;
    }

    this.saving = true;
    this.ai.updateMemoryFact(key, value, current?.category).subscribe({
      next: (res) => {
        this.facts = res.facts || [];
        this.saving = false;
        this.editingKey = null;
        this.draftValue = '';
      },
      error: (err) => {
        this.alert.error(err);
        this.saving = false;
      }
    });
  }

  removeFact(key: string): void {
    if (this.removing || this.editingKey) {
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
    if (this.saving) {
      return;
    }
    this.dialogRef.close(this.facts);
  }
}
