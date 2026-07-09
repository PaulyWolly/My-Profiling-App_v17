import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

export const DEFAULT_AVATAR = '/assets/images/default-avatar.svg';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  /**
   * Base URL for uploaded media. Uses the current page origin on Render so a stale
   * environment.apiUrl (e.g. -v17 vs -v17-1) does not break profile images.
   */
  getMediaBaseUrl(): string {
    const envBase = (environment.apiUrl || 'http://localhost:5001').replace(/\/+$/, '');

    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin.replace(/\/+$/, '');

      if (!environment.production) {
        return envBase;
      }

      if (origin === envBase) {
        return origin;
      }

      // Single-service Render deploys: SPA and /uploads share the same host.
      if (window.location.hostname.endsWith('.onrender.com') && envBase.includes('onrender.com')) {
        return origin;
      }
    }

    return envBase;
  }

  /**
   * Resolves a stored profile/follower path to a browser-ready URL for <img src>.
   */
  resolveDisplayUrl(url: string | null | undefined): string {
    if (!url || !url.trim()) {
      return DEFAULT_AVATAR;
    }

    const trimmed = url.trim();

    if (trimmed.startsWith('data:')) {
      return trimmed;
    }

    if (trimmed.startsWith('https://') && !trimmed.includes('localhost')) {
      return trimmed;
    }

    if (trimmed.startsWith('http://') && !trimmed.includes('localhost')) {
      return trimmed;
    }

    if (trimmed.includes('localhost')) {
      const pathOnly = trimmed.replace(/^https?:\/\/[^/]+/, '');
      return this.resolveDisplayUrl(pathOnly || DEFAULT_AVATAR);
    }

    if (trimmed.startsWith('/assets/')) {
      return trimmed;
    }

    const base = this.getMediaBaseUrl();
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  }

  /**
   * @deprecated Prefer resolveDisplayUrl for img src. Kept for callers that store relative paths.
   */
  formatImageUrl(url: string): string {
    if (!url) return '';

    if (url.startsWith('https://') && !url.includes('localhost')) {
      return url;
    }

    if (url.startsWith('http://') && !url.includes('localhost')) {
      return url;
    }

    if (url.includes('localhost')) {
      return url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
    }

    const envBase = this.getMediaBaseUrl();
    if (url.startsWith(envBase)) {
      return url.replace(envBase + '/', '').replace(envBase, '');
    }

    return url.replace(/^\/+/, '');
  }

  getFullImageUrl(path: string): string {
    return this.resolveDisplayUrl(path);
  }

  formatAccountImages(account: any): any {
    if (!account) return account;

    const formatted = { ...account };

    if (formatted.profileImage) {
      formatted.profileImage = this.resolveDisplayUrl(formatted.profileImage);
    }

    if (formatted.companyLogo) {
      formatted.companyLogo = this.resolveDisplayUrl(formatted.companyLogo);
    }

    if (formatted.followerImages) {
      formatted.followerImages = formatted.followerImages.map((follower: any) => ({
        ...follower,
        imageUrl: follower.imageUrl ? this.resolveDisplayUrl(follower.imageUrl) : undefined
      }));
    }

    return formatted;
  }

  onImageError(event: Event, fallback: string = DEFAULT_AVATAR): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src.endsWith(fallback)) {
      return;
    }
    img.src = fallback;
  }
}
