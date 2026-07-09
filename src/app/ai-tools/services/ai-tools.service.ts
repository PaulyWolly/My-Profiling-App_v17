import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

const baseUrl = `${environment.apiUrl}/api/ai`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiDocumentSummary {
  id: string;
  originalName: string;
  mimeType?: string;
  charCount?: number;
  chunkCount?: number;
  embeddingModel?: string;
}

export interface RagAnswer {
  answer: string;
  documentName: string;
  sources: { excerpt: string; score: number }[];
}

@Injectable({ providedIn: 'root' })
export class AiToolsService {
  constructor(private http: HttpClient) {}

  getStatus(): Observable<{
    configured: boolean;
    webSearch?: boolean;
    chatModel?: string;
    ragMaxUploadMb?: number;
    imageGenModel?: string;
    imageGenSizes?: string[];
    imageGenSupportsStyle?: boolean;
  }> {
    return this.http.get<{
      configured: boolean;
      webSearch?: boolean;
      chatModel?: string;
      ragMaxUploadMb?: number;
      imageGenModel?: string;
      imageGenSizes?: string[];
      imageGenSupportsStyle?: boolean;
    }>(`${baseUrl}/status`);
  }

  chat(messages: ChatMessage[]): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${baseUrl}/chat`, { messages });
  }

  describeImage(file: File, prompt?: string): Observable<{ description: string }> {
    const form = new FormData();
    form.append('image', file, file.name || 'image.jpg');
    if (prompt?.trim()) {
      form.append('prompt', prompt.trim());
    }
    return this.http.post<{ description: string }>(`${baseUrl}/describe-image`, form);
  }

  generateImage(
    prompt: string,
    options?: { size?: string; quality?: 'standard' | 'hd'; style?: 'vivid' | 'natural' }
  ): Observable<{ imageDataUrl: string; revisedPrompt: string | null; model: string; size: string }> {
    return this.http.post<{ imageDataUrl: string; revisedPrompt: string | null; model: string; size: string }>(
      `${baseUrl}/generate-image`,
      {
        prompt: prompt.trim(),
        size: options?.size,
        quality: options?.quality,
        style: options?.style
      }
    );
  }

  listDocuments(): Observable<AiDocumentSummary[]> {
    return this.http.get<AiDocumentSummary[]>(`${baseUrl}/documents`);
  }

  uploadDocument(file: File): Observable<AiDocumentSummary> {
    const form = new FormData();
    form.append('document', file);
    return this.http.post<AiDocumentSummary>(`${baseUrl}/documents`, form);
  }

  deleteDocument(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${baseUrl}/documents/${id}`);
  }

  askDocument(id: string, question: string): Observable<RagAnswer> {
    return this.http.post<RagAnswer>(`${baseUrl}/documents/${id}/ask`, { question });
  }
}
