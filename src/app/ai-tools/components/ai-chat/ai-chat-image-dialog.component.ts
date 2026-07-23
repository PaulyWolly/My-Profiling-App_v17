import { Component, HostListener, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ChatImage } from '../../services/ai-tools.service';

export interface ChatImageLightboxData {
  images: ChatImage[];
  startIndex?: number;
}

@Component({
  selector: 'app-ai-chat-image-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="lightbox" *ngIf="current as img">
      <div class="lightbox-header">
        <div class="lightbox-heading">
          <h2 class="lightbox-title">{{ img.title || 'Image' }}</h2>
          <span class="lightbox-count" *ngIf="images.length > 1">
            {{ index + 1 }} / {{ images.length }}
          </span>
        </div>
        <button mat-icon-button type="button" aria-label="Close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="lightbox-body">
        <button
          *ngIf="images.length > 1"
          type="button"
          class="nav-btn nav-prev"
          aria-label="Previous image"
          (click)="prev()">
          <mat-icon>chevron_left</mat-icon>
        </button>

        <img [src]="img.url" [alt]="img.title || 'Image'" />

        <button
          *ngIf="images.length > 1"
          type="button"
          class="nav-btn nav-next"
          aria-label="Next image"
          (click)="next()">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>

      <div class="lightbox-footer">
        <a *ngIf="img.pageUrl" [href]="img.pageUrl" target="_blank" rel="noopener noreferrer">
          {{ img.source || 'Open source' }}
        </a>
        <span *ngIf="!img.pageUrl && img.source">{{ img.source }}</span>
        <span *ngIf="!img.pageUrl && !img.source"></span>
        <button mat-stroked-button type="button" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .lightbox {
      display: flex;
      flex-direction: column;
      width: min(92vw, 900px);
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
    .lightbox-heading {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
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
    .lightbox-count {
      font-size: 0.8rem;
      color: #607d8b;
      font-weight: 600;
    }
    .lightbox-body {
      position: relative;
      padding: 0.75rem 3.25rem;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #0f172a;
      min-height: 240px;
    }
    .lightbox-body img {
      display: block;
      max-width: 100%;
      max-height: min(70vh, 720px);
      object-fit: contain;
      border-radius: 4px;
    }
    .nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.92);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .nav-btn:hover {
      background: #fff;
      transform: translateY(-50%) scale(1.05);
    }
    .nav-btn mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      line-height: 28px;
    }
    .nav-prev { left: 0.5rem; }
    .nav-next { right: 0.5rem; }
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
    @media (max-width: 600px) {
      .lightbox-body {
        padding: 0.75rem 2.75rem;
      }
      .nav-btn {
        width: 38px;
        height: 38px;
      }
    }
  `]
})
export class AiChatImageDialogComponent {
  readonly images: ChatImage[];
  index = 0;

  constructor(
    private dialogRef: MatDialogRef<AiChatImageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: ChatImageLightboxData
  ) {
    this.images = (data?.images || []).filter((img) => !!img?.url);
    const start = typeof data?.startIndex === 'number' ? data.startIndex : 0;
    this.index = this.images.length
      ? ((start % this.images.length) + this.images.length) % this.images.length
      : 0;
  }

  get current(): ChatImage | null {
    return this.images[this.index] || null;
  }

  prev(): void {
    if (this.images.length < 2) return;
    this.index = (this.index - 1 + this.images.length) % this.images.length;
  }

  next(): void {
    if (this.images.length < 2) return;
    this.index = (this.index + 1) % this.images.length;
  }

  close(): void {
    this.dialogRef.close();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
    // Escape / backdrop do not close — only Close or X
  }
}
