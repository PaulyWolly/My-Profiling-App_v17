import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { EMPTY, Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { environment } from '@environments/environment';

const baseUrl = `${environment.apiUrl}/api/ai`;

export interface ChatImage {
  url: string;
  title?: string;
  source?: string;
  pageUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Display text without embedded image markdown (assistant only). */
  displayContent?: string;
  images?: ChatImage[];
  /** Preview of a picture the user attached, shown for this session only. */
  attachmentUrl?: string;
  /** Subject the images were found under, so more can be asked for. */
  imageQuery?: string;
  imagesLoading?: boolean;
  /** Set once a search comes back empty — there is no more to show. */
  imagesExhausted?: boolean;
  createdAt?: string | Date;
}

export interface ChatResponse {
  reply: string;
  memoryFactCount?: number;
  images?: ChatImage[];
  imageQuery?: string;
  conversationId?: string;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  updated?: string | Date;
  created?: string | Date;
  preview?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

/** What the reply is waiting on, so the UI can say more than "Thinking…". */
export type ChatStreamStatus = 'searching' | 'writing' | 'images';

export type ChatStreamEvent =
  | { type: 'status'; value: ChatStreamStatus }
  | { type: 'delta'; value: string }
  | { type: 'rewrite'; value: string }
  | { type: 'images'; value: ChatImage[]; query?: string }
  | { type: 'done'; reply: string; memoryFactCount?: number; conversationId?: string }
  | { type: 'error'; message: string };

export interface MemoryFact {
  key: string;
  value: string;
  category: 'identity' | 'preference' | 'hobby' | 'like' | 'dislike' | 'secret' | 'other';
  updatedAt?: string | Date;
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

export interface TtsVoice {
  id: string;
  label: string;
}

export interface AiToolsStatus {
  configured: boolean;
  webSearch?: boolean;
  chatModel?: string;
  ragMaxUploadMb?: number;
  imageGenModel?: string;
  imageGenSizes?: string[];
  imageGenSupportsStyle?: boolean;
  imageDailyLimit?: number;
  /** null when the account has no cap (admins, or the limit turned off). */
  imagesRemaining?: number | null;
  imageUploadMaxMb?: number;
  ragMaxChars?: number;
  chatMaxMessages?: number;
  memoryMaxFacts?: number;
  chatMaxImages?: number;
  ttsVoices?: TtsVoice[];
  ttsDefaultVoice?: string;
  ttsProvider?: 'azure' | 'openai';
  memoryFactCount?: number;
}

export interface GeneratedImage {
  imageDataUrl: string;
  revisedPrompt: string | null;
  model: string;
  size: string;
  /** Absent when the account has no daily cap. */
  imagesRemaining?: number;
  imagesLimit?: number;
}

/** A picture taken from a document, on the page the answer was drawn from. */
export interface RagImage {
  url: string;
  page: number;
  /** Reads "p. 3" or "part 3"; a Word file has sections rather than pages. */
  pageLabel?: string;
  width?: number;
  height?: number;
  documentName?: string;
}

export interface RagMultiAnswer {
  answer: string;
  documentNames: string[];
  sources: { excerpt: string; score: number; documentName: string; page?: number }[];
  images?: RagImage[];
}

@Injectable({ providedIn: 'root' })
export class AiToolsService {
  constructor(private http: HttpClient) {}

  getStatus(): Observable<AiToolsStatus> {
    return this.http.get<AiToolsStatus>(`${baseUrl}/status`);
  }

  getConversation(): Observable<ChatConversation> {
    return this.http.get<ChatConversation>(`${baseUrl}/conversation`);
  }

  listConversations(): Observable<{ conversations: ChatConversationSummary[] }> {
    return this.http.get<{ conversations: ChatConversationSummary[] }>(`${baseUrl}/conversations`);
  }

  getConversationById(id: string): Observable<ChatConversation> {
    return this.http.get<ChatConversation>(`${baseUrl}/conversations/${encodeURIComponent(id)}`);
  }

  deleteConversation(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${baseUrl}/conversations/${encodeURIComponent(id)}`);
  }

  clearConversation(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${baseUrl}/conversation`);
  }

  getMemory(): Observable<{ facts: MemoryFact[] }> {
    return this.http.get<{ facts: MemoryFact[] }>(`${baseUrl}/memory`);
  }

  clearMemory(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${baseUrl}/memory`);
  }

  deleteMemoryFact(key: string): Observable<{ facts: MemoryFact[] }> {
    return this.http.delete<{ facts: MemoryFact[] }>(`${baseUrl}/memory/${encodeURIComponent(key)}`);
  }

  updateMemoryFact(key: string, value: string, category?: string): Observable<{ facts: MemoryFact[] }> {
    return this.http.put<{ facts: MemoryFact[] }>(
      `${baseUrl}/memory/${encodeURIComponent(key)}`,
      { value, category }
    );
  }

  chat(messages: ChatMessage[], conversationId?: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${baseUrl}/chat`, { messages, conversationId });
  }

  /**
   * A chat turn with a picture attached. Multipart rather than JSON because the
   * image travels with it, and unstreamed because the vision model answers in
   * one piece.
   */
  chatWithImage(messages: ChatMessage[], image: File, conversationId?: string): Observable<ChatResponse> {
    const form = new FormData();
    form.append('image', image);
    form.append('messages', JSON.stringify(messages));
    if (conversationId) {
      form.append('conversationId', conversationId);
    }
    return this.http.post<ChatResponse>(`${baseUrl}/chat/vision`, form);
  }

  /**
   * A further page of pictures for a subject already on screen. The URLs
   * already shown go along so the server can skip anything it repeats.
   */
  moreImages(query: string, exclude: string[]): Observable<{ images: ChatImage[] }> {
    return this.http.post<{ images: ChatImage[] }>(`${baseUrl}/chat/images/more`, { query, exclude });
  }

  /**
   * Emits reply events as the server produces them.
   *
   * Uses download-progress reporting rather than EventSource so the request can
   * be a POST and still pick up the auth interceptor. Each progress event
   * carries the whole body received so far, so only the newly completed lines
   * are parsed.
   */
  chatStream(messages: ChatMessage[], conversationId?: string): Observable<ChatStreamEvent> {
    let consumed = 0;

    return this.http
      .post(`${baseUrl}/chat/stream`, { messages, conversationId }, {
        observe: 'events',
        responseType: 'text',
        reportProgress: true
      })
      .pipe(
        concatMap((event) => {
          let received: string;
          if (event.type === HttpEventType.DownloadProgress) {
            received = (event as { partialText?: string }).partialText || '';
          } else if (event.type === HttpEventType.Response) {
            received = event.body || '';
          } else {
            return EMPTY;
          }

          // A trailing fragment is an incomplete line; leave it for next time.
          const boundary = received.lastIndexOf('\n');
          if (boundary < consumed) {
            return EMPTY;
          }

          const lines = received.slice(consumed, boundary).split('\n');
          consumed = boundary + 1;

          const parsed: ChatStreamEvent[] = [];
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              parsed.push(JSON.parse(line) as ChatStreamEvent);
            } catch {
              /* skip a malformed line rather than failing the whole reply */
            }
          }
          return from(parsed);
        })
      );
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
  ): Observable<GeneratedImage> {
    return this.http.post<GeneratedImage>(
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

  reindexDocument(id: string): Observable<AiDocumentSummary> {
    return this.http.post<AiDocumentSummary>(`${baseUrl}/documents/${id}/reindex`, {});
  }

  askDocument(id: string, question: string): Observable<RagAnswer> {
    return this.http.post<RagAnswer>(`${baseUrl}/documents/${id}/ask`, { question });
  }

  askDocuments(documentIds: string[], question: string): Observable<RagMultiAnswer> {
    return this.http.post<RagMultiAnswer>(`${baseUrl}/documents/ask`, { documentIds, question });
  }
}
