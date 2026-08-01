import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AiToolsService, AiToolsStatus } from '../../services/ai-tools.service';
import { HelpGuide, HelpTopic, helpGuide } from './ai-tools-help.content';

export interface AiToolsHelpDialogData {
  topic: HelpTopic;
  /** Passed in when the page already holds a status response, to skip the fetch. */
  status?: AiToolsStatus | null;
}

/**
 * The in-app guide for a single AI tool, opened from the "?" button on that
 * tool's page. Limits are read from the server so the copy cannot drift from
 * the configured values.
 */
@Component({
  selector: 'app-ai-tools-help-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="help-dialog">
      <div class="help-dialog-header">
        <div class="help-dialog-heading">
          <h2 class="help-dialog-title">{{ guide.title }}</h2>
          <span class="help-dialog-sub">Help &amp; limits</span>
        </div>
        <button mat-icon-button type="button" aria-label="Close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="help-dialog-body">
        <p class="help-intro">{{ guide.intro }}</p>

        <section class="help-limits">
          <h3 class="help-limits-title">
            <mat-icon>info</mat-icon>
            What you get
          </h3>
          <ul>
            <li *ngFor="let limit of guide.limits">{{ limit }}</li>
          </ul>
        </section>

        <section class="help-section" *ngFor="let section of guide.sections">
          <h3 class="help-section-title">{{ section.heading }}</h3>
          <ul>
            <li *ngFor="let item of section.items">{{ item }}</li>
          </ul>
        </section>
      </div>

      <div class="help-dialog-footer">
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .help-dialog {
      display: flex;
      flex-direction: column;
      width: min(94vw, 680px);
      max-height: 84vh;
      background: #fff;
    }
    .help-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem 0.65rem 1.25rem;
      background: #eaf4fb;
      border-bottom: 1px solid #d5e6f2;
      flex-shrink: 0;
    }
    .help-dialog-heading {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .help-dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
    }
    .help-dialog-sub {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1565c0;
    }
    .help-dialog-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: #64b5f6 #e8f4fc;
      padding: 1rem 0.75rem 1rem 1.25rem;
    }
    .help-dialog-body::-webkit-scrollbar {
      width: 12px;
      -webkit-appearance: none;
    }
    .help-dialog-body::-webkit-scrollbar-thumb {
      background: #64b5f6;
      border-radius: 6px;
      border: 2px solid #e8f4fc;
      min-height: 36px;
    }
    .help-dialog-body::-webkit-scrollbar-thumb:hover {
      background: #42a5f5;
    }
    .help-dialog-body::-webkit-scrollbar-track {
      background: #e8f4fc;
    }
    .help-intro {
      margin: 0 0 1rem;
      font-size: 0.98rem;
      line-height: 1.55;
      color: #333;
    }
    .help-limits {
      margin: 0 0 1.25rem;
      padding: 0.75rem 1rem;
      background: #f1f8fd;
      border: 1px solid #d5e6f2;
      border-radius: 8px;
    }
    .help-limits-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1565c0;
    }
    .help-limits-title .mat-icon {
      font-size: 19px;
      width: 19px;
      height: 19px;
    }
    .help-section {
      margin: 0 0 1.15rem;
    }
    .help-section:last-child {
      margin-bottom: 0;
    }
    .help-section-title {
      margin: 0 0 0.4rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1a1a1a;
    }
    .help-dialog-body ul {
      margin: 0;
      padding-left: 1.25rem;
    }
    .help-dialog-body li {
      margin-bottom: 0.35rem;
      font-size: 0.92rem;
      line-height: 1.5;
      color: #333;
    }
    .help-dialog-body li:last-child {
      margin-bottom: 0;
    }
    .help-dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 0.75rem 1.25rem;
      background: #f7fafc;
      border-top: 1px solid #e5eef5;
      flex-shrink: 0;
    }
  `]
})
export class AiToolsHelpDialogComponent {
  guide: HelpGuide;

  constructor(
    private dialogRef: MatDialogRef<AiToolsHelpDialogComponent>,
    ai: AiToolsService,
    @Inject(MAT_DIALOG_DATA) private data: AiToolsHelpDialogData
  ) {
    this.guide = helpGuide(data.topic, data.status ?? null);

    // The caller's status may predate the current allowance (an image could
    // have been generated since), so it is refreshed unless one was handed in.
    if (!data.status) {
      ai.getStatus().subscribe({
        next: (status) => { this.guide = helpGuide(this.data.topic, status); },
        error: () => { /* the guide already reads correctly without live numbers */ }
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
