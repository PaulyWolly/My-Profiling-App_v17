import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AiToolsService, AiDocumentSummary } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';

@Component({
  selector: 'app-ai-rag',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './ai-rag.component.html',
  styleUrls: ['./ai-rag.component.css']
})
export class AiRagComponent implements OnInit {
  documents: AiDocumentSummary[] = [];
  selectedId: string | null = null;
  question = '';
  answer = '';
  sources: { excerpt: string; score: number }[] = [];
  loadingDocs = false;
  uploading = false;
  asking = false;
  configured = true;
  ragMaxUploadMb = 50;

  constructor(private ai: AiToolsService, private alert: AlertService) {}

  ngOnInit(): void {
    this.ai.getStatus().subscribe({
      next: (s) => {
        this.configured = s.configured;
        if (s.ragMaxUploadMb) {
          this.ragMaxUploadMb = s.ragMaxUploadMb;
        }
      },
      error: () => { this.configured = false; }
    });
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loadingDocs = true;
    this.ai.listDocuments().subscribe({
      next: (docs) => {
        this.documents = docs;
        if (!this.selectedId && docs.length) {
          this.selectedId = docs[0].id;
        }
        this.loadingDocs = false;
      },
      error: (err) => {
        this.alert.error(err);
        this.loadingDocs = false;
      }
    });
  }

  onUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading = true;
    this.ai.uploadDocument(file).subscribe({
      next: (doc) => {
        const indexLabel = doc.embeddingModel === 'keyword-search'
          ? 'keyword search'
          : 'vector index';
        this.alert.success(`Uploaded "${doc.originalName}" (${doc.chunkCount} chunks, ${indexLabel})`);
        this.uploading = false;
        input.value = '';
        this.loadDocuments();
        this.selectedId = doc.id;
      },
      error: (err) => {
        this.alert.error(err);
        this.uploading = false;
        input.value = '';
      }
    });
  }

  deleteDoc(id: string): void {
    if (!confirm('Delete this document from your library?')) return;
    this.ai.deleteDocument(id).subscribe({
      next: () => {
        if (this.selectedId === id) {
          this.selectedId = null;
          this.answer = '';
          this.sources = [];
        }
        this.loadDocuments();
      },
      error: (err) => this.alert.error(err)
    });
  }

  ask(): void {
    const q = this.question.trim();
    if (!this.selectedId || !q || this.asking) return;

    this.asking = true;
    this.answer = '';
    this.sources = [];

    this.ai.askDocument(this.selectedId, q).subscribe({
      next: (res) => {
        this.answer = res.answer;
        this.sources = res.sources || [];
        this.asking = false;
      },
      error: (err) => {
        this.alert.error(err);
        this.asking = false;
      }
    });
  }
}
