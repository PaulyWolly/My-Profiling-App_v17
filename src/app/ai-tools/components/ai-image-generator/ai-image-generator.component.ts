import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs/operators';

import { AiToolsService, AiToolsStatus } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { AiToolsHelpButtonComponent } from '../ai-tools-help/ai-tools-help-button.component';

/** Pre-filled so a first-time visitor can hit Generate and see what the tool does. */
const EXAMPLE_PROMPT =
  'A watercolor image of a man and a woman holding hands and walking away from the ' +
  'Eiffel Tower in France in the background. The sun is just going down and the ' +
  'street lights are starting to come on.';

const WIDE_SIZE = '1536x1024';

@Component({
  selector: 'app-ai-image-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    AiToolsHelpButtonComponent
  ],
  templateUrl: './ai-image-generator.component.html',
  styleUrls: ['./ai-image-generator.component.css']
})
export class AiImageGeneratorComponent implements OnInit {
  readonly examplePrompt = EXAMPLE_PROMPT;

  prompt = EXAMPLE_PROMPT;
  size = WIDE_SIZE;
  quality: 'standard' | 'hd' = 'hd';
  style: 'vivid' | 'natural' = 'vivid';
  sizes = ['1024x1024', '1536x1024', '1024x1536'];
  supportsStyleParam = false;

  imageDataUrl: string | null = null;
  revisedPrompt: string | null = null;
  modelUsed = '';
  loading = false;
  configured = true;
  status: AiToolsStatus | null = null;

  /** null means this account has no daily cap. */
  imagesRemaining: number | null = null;
  imagesLimit = 0;

  constructor(private ai: AiToolsService, private alert: AlertService) {}

  ngOnInit(): void {
    this.ai.getStatus().subscribe({
      next: (s) => {
        this.configured = s.configured;
        this.status = s;
        if (s.imageGenSizes?.length) {
          this.sizes = s.imageGenSizes;
          if (!this.sizes.includes(this.size)) {
            this.size = this.widestSize();
          }
        }
        this.supportsStyleParam = !!s.imageGenSupportsStyle;
        this.imagesRemaining = s.imagesRemaining ?? null;
        this.imagesLimit = s.imageDailyLimit ?? 0;
      },
      error: () => { this.configured = false; }
    });
  }

  /** Falls back to the most landscape option the server offers when 1536x1024 is unavailable. */
  private widestSize(): string {
    const ratio = (value: string) => {
      const [w, h] = value.split('x').map(Number);
      return w && h ? w / h : 0;
    };
    return [...this.sizes].sort((a, b) => ratio(b) - ratio(a))[0] || this.sizes[0];
  }

  useExample(): void {
    if (this.loading) return;
    this.prompt = this.examplePrompt;
  }

  /** Enter starts generation; Shift+Enter inserts a newline. */
  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) {
      return;
    }
    keyEvent.preventDefault();
    this.generate();
  }

  generate(): void {
    const text = this.prompt.trim();
    if (!text || this.loading) return;

    this.loading = true;
    this.imageDataUrl = null;
    this.revisedPrompt = null;

    this.ai.generateImage(text, {
      size: this.size,
      quality: this.quality,
      style: this.style
    }).pipe(
      finalize(() => { this.loading = false; })
    ).subscribe({
      next: (res) => {
        this.imageDataUrl = res.imageDataUrl;
        this.revisedPrompt = res.revisedPrompt;
        this.modelUsed = res.model;
        if (res.imagesRemaining !== undefined) {
          this.imagesRemaining = res.imagesRemaining;
          this.imagesLimit = res.imagesLimit ?? this.imagesLimit;
          this.syncStatusQuota();
        }
      },
      error: (err) => {
        // A refused request means the allowance is spent, whatever we last read.
        if (err?.status === 429 || /daily image limit/i.test(String(err?.message ?? err))) {
          this.imagesRemaining = 0;
          this.syncStatusQuota();
        }
        this.alert.error(err);
      }
    });
  }

  /** Keeps the status handed to the help dialog in step with the live count. */
  private syncStatusQuota(): void {
    if (this.status) {
      this.status = { ...this.status, imagesRemaining: this.imagesRemaining };
    }
  }

  clear(): void {
    this.prompt = '';
    this.imageDataUrl = null;
    this.revisedPrompt = null;
    this.modelUsed = '';
  }

  downloadImage(): void {
    if (!this.imageDataUrl) return;
    const link = document.createElement('a');
    link.href = this.imageDataUrl;
    link.download = `dalle-${Date.now()}.png`;
    link.click();
  }
}
