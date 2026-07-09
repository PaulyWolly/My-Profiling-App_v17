import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs/operators';

import { AiToolsService } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';

@Component({
  selector: 'app-ai-image-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './ai-image-generator.component.html',
  styleUrls: ['./ai-image-generator.component.css']
})
export class AiImageGeneratorComponent implements OnInit {
  prompt = '';
  size = '1024x1024';
  quality: 'standard' | 'hd' = 'standard';
  style: 'vivid' | 'natural' = 'vivid';
  sizes = ['1024x1024', '1536x1024', '1024x1536'];
  supportsStyleParam = false;

  imageDataUrl: string | null = null;
  revisedPrompt: string | null = null;
  modelUsed = '';
  loading = false;
  configured = true;

  constructor(private ai: AiToolsService, private alert: AlertService) {}

  ngOnInit(): void {
    this.ai.getStatus().subscribe({
      next: (s) => {
        this.configured = s.configured;
        if (s.imageGenSizes?.length) {
          this.sizes = s.imageGenSizes;
        }
        this.supportsStyleParam = !!s.imageGenSupportsStyle;
      },
      error: () => { this.configured = false; }
    });
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
      },
      error: (err) => this.alert.error(err)
    });
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
