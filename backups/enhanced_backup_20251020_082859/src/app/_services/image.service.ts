import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private apiUrl = environment.apiUrl || 'http://localhost:5001';

  /**
   * Formats an image URL to be relative to the API URL
   * @param url The image URL to format
   * @returns The formatted URL
   */
  formatImageUrl(url: string): string {
    if (!url) return '';
    
    // If it's already a relative path, return as is
    if (!url.startsWith('http')) return url;
    
    // If it's a full URL, convert to relative path
    if (url.startsWith(this.apiUrl)) {
      return url.replace(this.apiUrl + '/', '');
    }
    
    return url;
  }

  /**
   * Gets the full URL for an image path
   * @param path The relative image path
   * @returns The full URL
   */
  getFullImageUrl(path: string): string {
    if (!path) return '';
    
    // If it's already a full URL, return as is
    if (path.startsWith('http')) return path;
    
    // If it's a relative path, prepend the API URL
    const normalizedPath = path.replace(/^\/+/, '').replace(/^\/+/, '');
    const fullUrlFixed = `${this.apiUrl}/${normalizedPath}`;
    console.log('[ImageService] getFullImageUrl:', { path, fullUrl: fullUrlFixed });
    return fullUrlFixed;
  }

  /**
   * Formats all image URLs in an account object
   * @param account The account object to format
   * @returns The formatted account object
   */
  formatAccountImages(account: any): any {
    if (!account) return account;

    const formatted = { ...account };

    // Format profile image
    if (formatted.profileImage) {
      formatted.profileImage = this.formatImageUrl(formatted.profileImage);
    }

    // Format company logo
    if (formatted.companyLogo) {
      formatted.companyLogo = this.formatImageUrl(formatted.companyLogo);
    }

    // Format follower images
    if (formatted.followerImages) {
      formatted.followerImages = formatted.followerImages.map((follower: any) => ({
        ...follower,
        imageUrl: follower.imageUrl ? this.formatImageUrl(follower.imageUrl) : undefined
      }));
    }

    return formatted;
  }
} 