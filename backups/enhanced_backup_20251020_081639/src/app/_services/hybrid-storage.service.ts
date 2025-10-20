import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '@environments/environment';

export interface HybridUploadResult {
  message: string;
  imagePath: string;
  profileImage?: string;
  companyLogo?: string;
  imageUrl?: string;
  localPath: string;
  hybrid: {
    s3Url: string;
    localPath: string;
    primary: 's3' | 'local';
    fallback: 's3' | 'local';
  };
}

@Injectable({
  providedIn: 'root'
})
export class HybridStorageService {
  private baseUrl = `${environment.apiUrl}/api/hybrid-upload`;

  constructor(private http: HttpClient) {}

  /**
   * Upload profile image to both S3 and local storage
   */
  uploadProfileImage(userId: string, file: File): Observable<HybridUploadResult> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('userId', userId);

    return this.http.post<HybridUploadResult>(`${this.baseUrl}/profile-image`, formData);
  }

  /**
   * Upload follower image to both S3 and local storage
   */
  uploadFollowerImage(name: string, file: File): Observable<HybridUploadResult> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);

    return this.http.post<HybridUploadResult>(`${this.baseUrl}/follower-image`, formData);
  }

  /**
   * Upload company logo to both S3 and local storage
   */
  uploadCompanyLogo(userId: string, file: File): Observable<HybridUploadResult> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('userId', userId);

    return this.http.post<HybridUploadResult>(`${this.baseUrl}/company-logo`, formData);
  }

  /**
   * Delete image from both S3 and local storage
   */
  deleteImage(s3Url: string, localPath: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/image`, {
      body: { s3Url, localPath }
    });
  }

  /**
   * Get the best available URL for an image
   * Tries local first, then falls back to S3
   */
  getBestImageUrl(s3Url: string, localPath: string): string {
    // For now, prefer S3 URL as it's more reliable
    // In the future, we could implement local file checking
    return s3Url || localPath;
  }

  /**
   * Check if an image URL is from S3
   */
  isS3Url(url: string): boolean {
    return url && url.includes('amazonaws.com');
  }

  /**
   * Check if an image URL is local
   */
  isLocalUrl(url: string): boolean {
    return url && (url.startsWith('/uploads/') || url.includes('localhost'));
  }

  /**
   * Get image info from URL
   */
  getImageInfo(url: string): { type: 's3' | 'local' | 'unknown', bucket?: string, key?: string } {
    if (this.isS3Url(url)) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        return {
          type: 's3',
          bucket: urlObj.hostname.split('.')[0],
          key: pathParts.slice(1).join('/')
        };
      } catch {
        return { type: 'unknown' };
      }
    } else if (this.isLocalUrl(url)) {
      return { type: 'local' };
    }
    return { type: 'unknown' };
  }

  /**
   * Format image URL for display
   * Handles both S3 and local URLs
   */
  formatImageUrl(url: string): string {
    if (!url) return '';

    // If it's already a full URL (S3), return as-is
    if (url.startsWith('http')) {
      return url;
    }

    // If it's a local path, prepend the API URL
    if (url.startsWith('/uploads/')) {
      return `${environment.apiUrl}${url}`;
    }

    // If it's a relative path, prepend the API URL
    return `${environment.apiUrl}/${url}`;
  }

  /**
   * Test image availability
   * Checks if an image URL is accessible
   */
  testImageAvailability(url: string): Observable<boolean> {
    if (!url) return of(false);

    return new Observable(observer => {
      const img = new Image();
      img.onload = () => observer.next(true);
      img.onerror = () => observer.next(false);
      img.src = url;
    });
  }

  /**
   * Get fallback URL if primary fails
   */
  getFallbackUrl(primaryUrl: string, fallbackUrl: string): Observable<string> {
    return this.testImageAvailability(primaryUrl).pipe(
      switchMap(isAvailable => {
        if (isAvailable) {
          return of(primaryUrl);
        } else {
          console.warn('[HybridStorage] Primary URL failed, using fallback:', fallbackUrl);
          return of(fallbackUrl);
        }
      }),
      catchError(() => {
        console.warn('[HybridStorage] Both URLs failed, using fallback:', fallbackUrl);
        return of(fallbackUrl);
      })
    );
  }
}
