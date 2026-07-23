import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ChatImageLightboxData {
  url: string;
  title?: string;
  source?: string;
  pageUrl?: string;
}

@Component({
  selector: 'app-ai-chat-image-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="lightbox">
      <div class="lightbox-header">
        <h2 class="lightbox-title">{{ data.title || 'Image' }}</h2>
        <button mat-icon-button type="button" aria-label="Close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="lightbox-body">
        <img [src]="data.url" [alt]="data.title || 'Image'" />
      </div>
      <div class="lightbox-footer" *ngIf="data.pageUrl || data.source">
        <a *ngIf="data.pageUrl" [href]="data.pageUrl" target="_blank" rel="noopener noreferrer">
          {{ data.source || 'Open source' }}
        </a>
        <span *ngIf="!data.pageUrl && data.source">{{ data.source }}</span>
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
      <div class="lightbox-footer" *ngIf="!data.pageUrl && !data.source">
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .lightbox {
      display: flex;
      flex-direction: column;
      max-width: min(92vw, 900px);
      max-height: 90vh;
      background: #fff;
    }
    .lightbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem 0.65rem 1rem;
      background: #eaf4fb;
      border-bottom: 1px solid #d5e6f2;
    }
    .lightbox-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lightbox-body {
      padding: 0.75rem;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #0f172a;
      min-height: 200px;
    }
    .lightbox-body img {
      display: block;
      max-width: 100%;
      max-height: min(70vh, 720px);
      object-fit: contain;
      border-radius: 4px;
    }
    .lightbox-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: #f7fafc;
      border-top: 1px solid #e5eef5;
    }
    .lightbox-footer a {
      color: #1565c0;
      font-weight: 600;
      text-decoration: underline;
      font-size: 0.9rem;
    }
  `]
})
export class AiChatImageDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<AiChatImageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ChatImageLightboxData
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
