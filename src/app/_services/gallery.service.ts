import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { GalleryItem, GallerySettings } from '@app/_models/gallery.model';

export type GalleryUploadProgress = { type: 'progress'; percent: number } | { type: 'done'; response: { url: string; type: 'image' | 'video'; caption: string } };

const apiUrl = `${environment.apiUrl}/api/gallery`;
const hybridUrl = `${environment.apiUrl}/api/hybrid-upload`;

@Injectable({ providedIn: 'root' })
export class GalleryService {
  constructor(private http: HttpClient) {}

  getMyGallery(): Observable<GalleryItem[]> {
    return this.http.get<GalleryItem[]>(`${apiUrl}/me`);
  }

  getGalleryForAccount(accountId: string): Observable<GalleryItem[]> {
    return this.http.get<GalleryItem[]>(`${apiUrl}/${accountId}`);
  }

  /** Accounts that have shared their gallery with the current user (for "Shared with me" in modal). */
  getSharedWithMe(): Observable<{ id: string; firstName: string; lastName: string }[]> {
    return this.http.get<{ id: string; firstName: string; lastName: string }[]>(`${apiUrl}/shared-with-me`);
  }

  /** Total number of items in galleries shared with the current user (for "Gallery (n) [m]" tab label). */
  getSharedWithMeTotalItems(): Observable<{ totalItems: number }> {
    return this.http.get<{ totalItems: number }>(`${apiUrl}/shared-with-me/total-items`);
  }

  createItem(payload: { url: string; type: 'image' | 'video'; caption?: string; thumbnailUrl?: string }): Observable<GalleryItem> {
    return this.http.post<GalleryItem>(`${apiUrl}`, payload);
  }

  deleteItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${apiUrl}/${id}`);
  }

  getSettings(): Observable<GallerySettings> {
    return this.http.get<GallerySettings>(`${apiUrl}/settings/me`);
  }

  updateSettings(settings: Partial<GallerySettings>): Observable<GallerySettings> {
    return this.http.patch<GallerySettings>(`${apiUrl}/settings/me`, settings);
  }

  /** Upload file (image or video); returns { url, type, caption }. Call createItem with the url next. */
  uploadMedia(file: File, caption?: string): Observable<{ url: string; type: 'image' | 'video'; caption: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return this.http.post<{ url: string; type: 'image' | 'video'; caption: string }>(
      `${hybridUrl}/gallery-media`,
      formData
    );
  }

  /** Upload with progress events: emits { type: 'progress', percent } then { type: 'done', response }. */
  uploadMediaWithProgress(file: File, caption?: string): Observable<GalleryUploadProgress> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return this.http
      .post<{ url: string; type: 'image' | 'video'; caption: string }>(`${hybridUrl}/gallery-media`, formData, {
        reportProgress: true,
        observe: 'events'
      })
      .pipe(
        filter((event) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
        map((event): GalleryUploadProgress | null => {
          if (event.type === HttpEventType.UploadProgress && event.total && event.total > 0) {
            const percent = Math.round((100 * event.loaded) / event.total);
            return { type: 'progress', percent };
          }
          if (event.type === HttpEventType.Response && event.body) {
            return { type: 'done', response: event.body as { url: string; type: 'image' | 'video'; caption: string } };
          }
          return null;
        }),
        filter((x): x is GalleryUploadProgress => x !== null)
      );
  }
}
