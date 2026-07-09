import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface AiImageDescriptionDialogData {
  description: string;
  fileName?: string;
}

@Component({
  selector: 'app-ai-image-description-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Image Analysis</h2>
    <p class="file-name" *ngIf="data.fileName">{{ data.fileName }}</p>
    <mat-dialog-content class="description-scroll">
      <div class="description-body">{{ data.description }}</div>
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

    .file-name {
      margin: -0.25rem 0 0.75rem;
      padding: 0 24px;
      color: #6b8fa8;
      font-size: 0.9rem;
    }

    .description-scroll {
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

    .description-scroll::-webkit-scrollbar {
      width: 14px;
      -webkit-appearance: none;
    }

    .description-scroll::-webkit-scrollbar-thumb {
      background: #64b5f6;
      border-radius: 7px;
      border: 3px solid #d0e3ef;
      min-height: 48px;
    }

    .description-scroll::-webkit-scrollbar-thumb:hover {
      background: #42a5f5;
    }

    .description-scroll::-webkit-scrollbar-track {
      background: #d0e3ef;
      border-radius: 7px;
      box-shadow: inset 1px 0 0 #b8d9ee;
    }

    .description-body {
      white-space: pre-wrap;
      line-height: 1.6;
      margin: 0;
      word-break: break-word;
      color: #333;
    }
  `]
})
export class AiImageDescriptionDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AiImageDescriptionDialogData,
    private dialogRef: MatDialogRef<AiImageDescriptionDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
