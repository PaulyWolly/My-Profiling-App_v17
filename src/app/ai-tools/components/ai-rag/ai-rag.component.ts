import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiToolsService, AiDocumentSummary } from '../../services/ai-tools.service';
import { AlertService } from '@app/_services';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { AiRagAnswerDialogComponent } from './ai-rag-answer-dialog.component';

@Component({
  selector: 'app-ai-rag',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule
  ],
  templateUrl: './ai-rag.component.html',
  styleUrls: ['./ai-rag.component.css']
})
export class AiRagComponent implements OnInit {
  documents: AiDocumentSummary[] = [];
  selectedIds = new Set<string>();
  question = '';
  answer = '';
  sources: { excerpt: string; score: number; documentName?: string }[] = [];
  answeredFrom: string[] = [];
  loadingDocs = false;
  uploading = false;
  asking = false;
  reindexingId: string | null = null;
  configured = true;
  ragMaxUploadMb = 100;

  constructor(
    private ai: AiToolsService,
    private alert: AlertService,
    private dialog: MatDialog
  ) {}

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
        // Drop selections for documents that no longer exist.
        const live = new Set(docs.map((d) => d.id));
        for (const id of [...this.selectedIds]) {
          if (!live.has(id)) this.selectedIds.delete(id);
        }
        if (!this.selectedIds.size && docs.length) {
          this.selectedIds.add(docs[0].id);
        }
        this.loadingDocs = false;
      },
      error: (err) => {
        this.alert.error(err);
        this.loadingDocs = false;
      }
    });
  }

  // Selection ---------------------------------------------------------------

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleDoc(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  get allSelected(): boolean {
    return this.documents.length > 0 && this.selectedIds.size === this.documents.length;
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  /** Selects every document, or clears the selection when all are already selected. */
  toggleAllDocuments(): void {
    if (this.allSelected) {
      this.selectedIds.clear();
    } else {
      this.selectedIds = new Set(this.documents.map((d) => d.id));
    }
  }

  // Documents ---------------------------------------------------------------

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
        this.selectedIds.add(doc.id);
        this.loadDocuments();
      },
      error: (err) => {
        this.alert.error(err);
        this.uploading = false;
        input.value = '';
      }
    });
  }

  deleteDoc(id: string): void {
    const doc = this.documents.find((d) => d.id === id);
    const name = doc?.originalName ? `"${doc.originalName}"` : 'this document';

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete document?',
        message: `Remove ${name} from your library? Its index will be deleted and you will need to upload the file again to ask questions about it.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.ai.deleteDocument(id).subscribe({
        next: () => {
          this.selectedIds.delete(id);
          if (!this.selectedIds.size) {
            this.answer = '';
            this.sources = [];
            this.answeredFrom = [];
          }
          this.loadDocuments();
        },
        error: (err) => this.alert.error(err)
      });
    });
  }

  isKeywordIndexed(doc: AiDocumentSummary): boolean {
    return doc.embeddingModel === 'keyword-search';
  }

  get keywordDocCount(): number {
    return this.documents.filter((d) => this.isKeywordIndexed(d)).length;
  }

  reindex(id: string): void {
    if (this.reindexingId) return;

    this.reindexingId = id;
    this.ai.reindexDocument(id).subscribe({
      next: (doc) => {
        this.alert.success(`Re-indexed "${doc.originalName}" with ${doc.embeddingModel}`);
        this.reindexingId = null;
        this.loadDocuments();
      },
      error: (err) => {
        this.alert.error(err);
        this.reindexingId = null;
      }
    });
  }

  // Asking ------------------------------------------------------------------

  get canAsk(): boolean {
    return this.selectedIds.size > 0 && !!this.question.trim() && !this.asking;
  }

  /** Enter submits the question; Shift+Enter inserts a newline. */
  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) {
      return;
    }
    keyEvent.preventDefault();
    this.ask();
  }

  viewAnswer(): void {
    if (!this.answer) return;
    this.dialog.open(AiRagAnswerDialogComponent, {
      width: 'min(900px, 94vw)',
      data: {
        answer: this.answer,
        documentNames: this.answeredFrom,
        sources: this.sources
      }
    });
  }

  ask(): void {
    if (!this.canAsk) return;

    // Preserve library order so the answer header reads the same as the list.
    const ids = this.documents.filter((d) => this.selectedIds.has(d.id)).map((d) => d.id);

    this.asking = true;
    this.answer = '';
    this.sources = [];
    this.answeredFrom = [];

    this.ai.askDocuments(ids, this.question.trim()).subscribe({
      next: (res) => {
        this.answer = res.answer;
        this.sources = res.sources || [];
        this.answeredFrom = res.documentNames || [];
        this.asking = false;
      },
      error: (err) => {
        this.alert.error(err);
        this.asking = false;
      }
    });
  }
}
