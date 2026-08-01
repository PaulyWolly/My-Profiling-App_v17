import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs/operators';

import { AiToolsService, AiToolsStatus } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { AiImageDescriptionDialogComponent } from './ai-image-description-dialog.component';
import { AiToolsHelpButtonComponent } from '../ai-tools-help/ai-tools-help-button.component';

@Component({
  selector: 'app-ai-image',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    AiToolsHelpButtonComponent
  ],
  templateUrl: './ai-image.component.html',
  styleUrls: ['./ai-image.component.css']
})
export class AiImageComponent implements OnInit {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  file: File | null = null;
  previewUrl: string | null = null;
  prompt = 'Identify this image. If you recognize the subject (artwork, landmark, person, animal, nebula, galaxy, etc.), name it first and explain what it is. Then note key visual details.';
  description = '';
  loading = false;
  configured = true;
  status: AiToolsStatus | null = null;
  imageUploadMaxMb = 50;

  constructor(
    private ai: AiToolsService,
    private alert: AlertService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.ai.getStatus().subscribe({
      next: (s) => {
        this.configured = s.configured;
        this.status = s;
        this.imageUploadMaxMb = s.imageUploadMaxMb ?? this.imageUploadMaxMb;
      },
      error: () => { this.configured = false; }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!this.isImageFile(f)) {
      this.alert.error('Please choose an image file');
      return;
    }
    this.setImage(f);
  }

  resetImage(): void {
    if (this.loading) return;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.file = null;
    this.previewUrl = null;
    this.description = '';
    const input = this.fileInput?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  /** Enter starts analysis; Shift+Enter inserts a newline. */
  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) {
      return;
    }
    keyEvent.preventDefault();
    this.analyze();
  }

  analyze(): void {
    if (!this.file || this.loading) return;
    this.loading = true;
    this.ai.describeImage(this.file, this.prompt).pipe(
      finalize(() => { this.loading = false; })
    ).subscribe({
      next: (res) => {
        this.description = res.description;
        this.openDescriptionDialog();
      },
      error: (err) => {
        this.alert.error(err);
      }
    });
  }

  viewDescription(): void {
    if (!this.description) return;
    this.openDescriptionDialog();
  }

  private setImage(f: File): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.file = f;
    this.description = '';
    this.previewUrl = URL.createObjectURL(f);
  }

  private isImageFile(f: File): boolean {
    if (f.type?.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp|tiff?|jfif|pjp|apng|svg|heic|heif)$/i.test(f.name);
  }

  private openDescriptionDialog(): void {
    this.dialog.open(AiImageDescriptionDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        description: this.description,
        fileName: this.file?.name
      }
    });
  }
}
