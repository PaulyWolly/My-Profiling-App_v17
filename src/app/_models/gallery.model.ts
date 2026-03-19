export interface GalleryItem {
  id?: string;
  accountId: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt?: string | Date;
  shareMode?: 'all-shared' | 'specific';
  sharedWith?: string[];
}

/** Only private sharing: either only me or share with specific members. No public viewing. */
export type GalleryVisibility = 'private';

export interface GallerySettings {
  galleryVisibility: GalleryVisibility;
  gallerySharedWith: string[];
}
