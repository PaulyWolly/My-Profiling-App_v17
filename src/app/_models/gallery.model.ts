export interface GalleryItem {
  id?: string;
  accountId: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt?: string | Date;
  /**
   * owner-only = not visible to gallery viewers.
   * all-shared (stored legacy only): prefer specific + full gallerySharedWith from API.
   * specific + sharedWith: only those user ids can see the item when viewing your gallery.
   */
  shareMode?: 'owner-only' | 'all-shared' | 'specific';
  sharedWith?: string[];
  /** Server: true when owner chose "All shared members" — any current gallery member can see the item. */
  shareWithAllGalleryMembers?: boolean;
}

/** Only private sharing: either only me or share with specific members. No public viewing. */
export type GalleryVisibility = 'private';

export interface GallerySettings {
  galleryVisibility: GalleryVisibility;
  gallerySharedWith: string[];
}
