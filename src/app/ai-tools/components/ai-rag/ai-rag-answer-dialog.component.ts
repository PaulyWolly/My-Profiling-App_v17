import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { RagImage } from '../../services/ai-tools.service';
import { AiChatImageDialogComponent } from '../ai-chat/ai-chat-image-dialog.component';

export interface AiRagAnswerDialogData {
  answer: string;
  documentNames: string[];
  sources: { excerpt: string; score: number; documentName?: string }[];
  images?: RagImage[];
}

@Component({
  selector: 'app-ai-rag-answer-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Answer</h2>
    <p class="doc-names" *ngIf="data.documentNames?.length">{{ data.documentNames.join(', ') }}</p>
    <mat-dialog-content class="answer-scroll">
      <div class="answer-body">{{ data.answer }}</div>

      @if (images.length) {
        <div class="answer-images">
          <h3>Images from these pages</h3>
          <div class="image-grid">
            @for (img of images; track img.url) {
              <button
                type="button"
                class="image-thumb"
                (click)="openImage($index)"
                [attr.aria-label]="'View image from page ' + img.page">
                <img [src]="img.url" [alt]="'Page ' + img.page" loading="lazy" />
                <span class="image-page">p. {{ img.page }}</span>
              </button>
            }
          </div>
        </div>
      }

      <div class="sources" *ngIf="data.sources?.length">
        <h3>Sources</h3>
        <div class="source" *ngFor="let s of data.sources">
          <span class="source-doc" *ngIf="s.documentName">{{ s.documentName }}</span>
          {{ s.excerpt }}
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      margin: 0;
      color: #1a4d6d;
    }

    .doc-names {
      margin: -0.25rem 0 0.75rem;
      padding: 0 24px;
      color: #6b8fa8;
      font-size: 0.9rem;
    }

    .answer-scroll {
      display: block;
      max-height: min(70vh, 640px);
      min-height: 200px;
      overflow-x: hidden;
      overflow-y: scroll;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: #64b5f6 #d0e3ef;
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;
    }

    .answer-scroll::-webkit-scrollbar {
      width: 14px;
      -webkit-appearance: none;
    }

    .answer-scroll::-webkit-scrollbar-thumb {
      background: #64b5f6;
      border-radius: 7px;
      border: 3px solid #d0e3ef;
      min-height: 48px;
    }

    .answer-scroll::-webkit-scrollbar-thumb:hover {
      background: #42a5f5;
    }

    .answer-scroll::-webkit-scrollbar-track {
      background: #d0e3ef;
      border-radius: 7px;
      box-shadow: inset 1px 0 0 #b8d9ee;
    }

    .answer-body {
      white-space: pre-wrap;
      line-height: 1.6;
      margin: 0;
      word-break: break-word;
      color: #333;
    }

    .answer-images {
      margin-top: 1.25rem;
      border-top: 1px solid #d0e3ef;
      padding-top: 0.75rem;
    }

    .answer-images h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      color: #1a4d6d;
    }

    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.5rem;
    }

    .image-thumb {
      position: relative;
      padding: 0;
      border: 1px solid #d5e6f2;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      transition: border-color 0.15s ease, transform 0.15s ease;
    }

    .image-thumb:hover {
      border-color: #1565c0;
      transform: translateY(-2px);
    }

    .image-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .image-page {
      position: absolute;
      right: 0.25rem;
      bottom: 0.25rem;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      background: rgba(15, 23, 42, 0.75);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .sources {
      margin-top: 1.25rem;
      border-top: 1px solid #d0e3ef;
      padding-top: 0.75rem;
    }

    .sources h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      color: #1a4d6d;
    }

    .source {
      font-size: 0.85rem;
      color: #444;
      padding: 0.5rem;
      background: #f8fbfd;
      border-left: 3px solid #90caf9;
      margin-bottom: 0.5rem;
      overflow-wrap: anywhere;
    }

    .source-doc {
      display: block;
      font-weight: 600;
      color: #1a4d6d;
      margin-bottom: 0.2rem;
    }
  `]
})
export class AiRagAnswerDialogComponent {
  readonly images: RagImage[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AiRagAnswerDialogData,
    private dialogRef: MatDialogRef<AiRagAnswerDialogComponent>,
    private dialog: MatDialog
  ) {
    this.images = data?.images || [];
  }

  /** Opens on top of this dialog, so closing it returns here rather than to the page. */
  openImage(index: number): void {
    this.dialog.open(AiChatImageDialogComponent, {
      panelClass: 'chat-image-dialog',
      data: {
        images: this.images.map((img) => ({
          url: img.url,
          title: img.documentName ? `${img.documentName} — page ${img.page}` : `Page ${img.page}`
        })),
        startIndex: index
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
