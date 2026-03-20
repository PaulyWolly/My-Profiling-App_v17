import { Component, Inject, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { GalleryService } from '@app/_services/gallery.service';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';
import { GalleryItem } from '@app/_models/gallery.model';
import { Account } from '@app/_models';
import { environment } from '@environments/environment';

export interface GalleryModalData {
  accountId: string;
  isOwnProfile: boolean;
}

export interface SharedWithMeAccount {
  id: string;
  firstName: string;
  lastName: string;
}

@Component({
  selector: 'app-gallery-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatDialogModule
  ],
  templateUrl: './gallery-modal.component.html',
  styleUrls: ['./gallery-modal.component.scss']
})
export class GalleryModalComponent implements OnInit {
  accountId: string;
  isOwnProfile: boolean;

  /** When opened from own profile, we can switch to viewing someone's shared gallery; this is our own id to switch back. */
  myAccountId: string = '';

  items: GalleryItem[] = [];
  loading = true;
  uploading = false;
  onlyMe = true;
  gallerySharedWith: string[] = [];
  otherMembers: Account[] = [];
  loadingMembers = false;
  selectedFile: File | null = null;
  caption = '';
  showUploadArea = false;
  /** Upload progress 0–100 when uploading; null when not. */
  uploadProgressPercent: number | null = null;

  /** People who have shared their gallery with the current user. Loaded when viewing own profile. */
  sharedWithMeList: SharedWithMeAccount[] = [];
  loadingSharedWithMe = false;
  /** When viewing a shared gallery from "Shared with me", name to show in header. */
  viewingSharedName: string | null = null;

  /** Item shown in full-view overlay (click gallery image/video to open). */
  fullViewItem: GalleryItem | null = null;

  /** Show help popover when hovering over (?) icon. */
  showHelpPopover = false;

  /** When true, the "Select members" list is expanded; when false, it's collapsed to save space. */
  memberListExpanded = true;

  @ViewChildren('gridVideo') gridVideos: QueryList<ElementRef> | undefined;

  constructor(
    private dialogRef: MatDialogRef<GalleryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GalleryModalData,
    private galleryService: GalleryService,
    private accountService: AccountService,
    private alertService: AlertService
  ) {
    this.accountId = data.accountId;
    this.isOwnProfile = data.isOwnProfile;
    if (data.isOwnProfile && data.accountId) {
      this.myAccountId = data.accountId;
    }
  }

  /** True when we opened from own profile but are currently viewing someone else's shared gallery. */
  get isViewingSharedGallery(): boolean {
    return !!this.myAccountId && this.accountId !== this.myAccountId;
  }

  ngOnInit(): void {
    this.loadGallery();
    if (this.isOwnProfile) {
      this.galleryService.getSettings().subscribe((s) => {
        this.gallerySharedWith = (s.gallerySharedWith || []).map((id) => String(id));
        this.onlyMe = this.gallerySharedWith.length === 0;
        this.tryPruneOrphanGallerySharedWith();
      });
      this.loadOtherMembers();
      this.loadSharedWithMe();
    }
  }

  loadSharedWithMe(): void {
    this.loadingSharedWithMe = true;
    this.galleryService.getSharedWithMe().subscribe({
      next: (list) => {
        this.sharedWithMeList = list || [];
        this.loadingSharedWithMe = false;
      },
      error: () => { this.loadingSharedWithMe = false; }
    });
  }

  viewSharedGallery(account: SharedWithMeAccount): void {
    if (!account?.id) return;
    this.accountId = account.id;
    this.isOwnProfile = false;
    this.viewingSharedName = [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Shared gallery';
    this.loadGallery();
  }

  backToMyGallery(): void {
    if (!this.myAccountId) return;
    this.accountId = this.myAccountId;
    this.isOwnProfile = true;
    this.viewingSharedName = null;
    this.loadGallery();
  }

  openFullView(item: GalleryItem): void {
    this.gridVideos?.forEach((ref: ElementRef) => {
      const video = ref.nativeElement as HTMLVideoElement;
      if (video?.pause) video.pause();
    });
    this.fullViewItem = item;
  }

  closeFullView(): void {
    this.fullViewItem = null;
  }

  close(): void {
    this.dialogRef.close();
  }

  loadOtherMembers(): void {
    this.loadingMembers = true;
    this.accountService.getAll().subscribe({
      next: (accounts) => {
        const myId = this.accountService.accountValue?.id;
        this.otherMembers = (accounts || []).filter(
          (a) => a.id != null && (!myId || String(a.id) !== String(myId))
        );
        this.loadingMembers = false;
        this.tryPruneOrphanGallerySharedWith();
      },
      error: () => {
        this.loadingMembers = false;
      }
    });
  }

  /**
   * Members shown with a checkmark (must exist in directory). Can be less than gallerySharedWith.length
   * if the saved list still has deleted/duplicate account ids.
   */
  visibleGallerySharePickCount(): number {
    return this.otherMembers.filter((m) => m.id != null && this.isSharedWith(m.id!)).length;
  }

  /** Summary line: match chips once directory is loaded; avoids "3 selected" with only 2 checkmarks. */
  galleryShareSummaryCount(): number {
    if (this.loadingMembers || this.otherMembers.length === 0) {
      return this.gallerySharedWith.length;
    }
    return this.visibleGallerySharePickCount();
  }

  /**
   * Remove gallerySharedWith ids that are not current accounts (stale after merges/deletes).
   * Persists so server and per-item sharing stay consistent.
   */
  private tryPruneOrphanGallerySharedWith(): void {
    if (!this.isOwnProfile || this.loadingMembers || this.otherMembers.length === 0) {
      return;
    }
    if (this.gallerySharedWith.length === 0) {
      return;
    }
    const allowed = new Set(this.otherMembers.map((m) => String(m.id)));
    const pruned = this.gallerySharedWith.filter((id) => allowed.has(String(id)));
    if (pruned.length === this.gallerySharedWith.length) {
      return;
    }
    this.gallerySharedWith = pruned;
    this.onlyMe = pruned.length === 0;
    this.galleryService
      .updateSettings({ galleryVisibility: 'private', gallerySharedWith: pruned })
      .subscribe({ error: () => {} });
  }

  loadGallery(): void {
    if (!this.accountId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    const req = this.isOwnProfile
      ? this.galleryService.getMyGallery()
      : this.galleryService.getGalleryForAccount(this.accountId);
    req.subscribe({
      next: (list) => {
        this.items = (list || []).map((i) => ({
          ...i,
          sharedWith: (i.sharedWith || []).map((id) => String(id)),
          shareWithAllGalleryMembers: !!(i as GalleryItem).shareWithAllGalleryMembers
        }));
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.loading = false;
      }
    });
  }

  resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/+$/, '');
    return url.startsWith('/') ? base + url : base + '/' + url;
  }

  /** Allowed video extensions for gallery (e.g. .mkv when browser reports application/octet-stream). */
  private static readonly ALLOWED_VIDEO_EXT = ['.mkv', '.webm', '.mp4', '.mov', '.avi', '.m4v', '.ogv', '.wmv', '.mpeg', '.mpg'];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }
    const isImage = file.type.startsWith('image/');
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isVideoByType = file.type.startsWith('video/');
    const isVideoByExt = GalleryModalComponent.ALLOWED_VIDEO_EXT.includes(ext);
    if (isImage || isVideoByType || isVideoByExt) {
      this.selectedFile = file;
      this.showUploadArea = true;
    }
    input.value = '';
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.uploadProgressPercent = 0;
    this.galleryService.uploadMediaWithProgress(this.selectedFile, this.caption || undefined).subscribe({
      next: (event) => {
        if (event.type === 'progress') {
          this.uploadProgressPercent = event.percent;
        } else {
          this.uploadProgressPercent = 100;
          this.galleryService.createItem({
            url: event.response.url,
            type: event.response.type,
            caption: event.response.caption || ''
          }).subscribe({
            next: () => {
              this.loadGallery();
              this.selectedFile = null;
              this.caption = '';
              this.showUploadArea = false;
              this.uploading = false;
              this.uploadProgressPercent = null;
            },
            error: (err) => {
              this.uploading = false;
              this.uploadProgressPercent = null;
              const msg = err?.error?.message || err?.message || 'Failed to add item to gallery.';
              this.alertService.error(msg);
            }
          });
        }
      },
      error: (err) => {
        this.uploading = false;
        this.uploadProgressPercent = null;
        const msg = err?.error?.message || err?.message || 'Upload failed.';
        this.alertService.error(msg);
      }
    });
  }

  cancelUpload(): void {
    this.selectedFile = null;
    this.caption = '';
    this.showUploadArea = false;
    this.uploadProgressPercent = null;
  }

  deleteItem(item: GalleryItem): void {
    if (!item.id || !confirm('Remove this from your gallery?')) return;
    this.galleryService.deleteItem(item.id).subscribe({
      next: () => this.loadGallery()
    });
  }

  /**
   * UI: owner-only | all-shared (everyone in gallery member list) | specific (subset).
   * Stored as owner-only, or specific with sharedWith = full gallerySharedWith or a subset.
   * Legacy DB all-shared / missing shareMode → still show as "all shared" for owner until they save.
   */
  public getItemShareMode(item: GalleryItem): 'owner-only' | 'all-shared' | 'specific' {
    const m = item.shareMode;
    if (m === 'owner-only') return 'owner-only';
    if (m === 'all-shared' || m === undefined || m === null || (m as string) === '') {
      return 'all-shared';
    }
    if (m === 'specific') {
      if (item.shareWithAllGalleryMembers) {
        return 'all-shared';
      }
      const sw = new Set((item.sharedWith || []).map(String));
      const gw = new Set((this.gallerySharedWith || []).filter(Boolean).map(String));
      if (gw.size > 0 && sw.size === gw.size && [...gw].every((id) => sw.has(id))) {
        return 'all-shared';
      }
      return 'specific';
    }
    return 'owner-only';
  }

  public isItemOwnerOnly(item: GalleryItem): boolean {
    return this.getItemShareMode(item) === 'owner-only';
  }

  public isItemSpecific(item: GalleryItem): boolean {
    return this.getItemShareMode(item) === 'specific';
  }

  /** Viewers only see explicitly shared items — lock all; owner: no lock for "all gallery members" */
  public showLockOnThumbnail(item: GalleryItem): boolean {
    if (this.isViewingSharedGallery) {
      return true;
    }
    const mode = this.getItemShareMode(item);
    if (mode === 'all-shared') return false;
    return mode === 'owner-only' || mode === 'specific';
  }

  public lockIconTitle(item: GalleryItem): string {
    if (this.isViewingSharedGallery) {
      return 'Shared with you';
    }
    if (this.isItemOwnerOnly(item)) {
      return 'Only you can see this (not shared with gallery viewers)';
    }
    if (this.getItemShareMode(item) === 'all-shared') {
      return 'Visible to everyone in your gallery share list';
    }
    return 'Shared only with selected members';
  }

  public isItemSharedWith(item: GalleryItem, accountId: string): boolean {
    const id = String(accountId);
    return (item.sharedWith || []).some((x) => String(x) === id);
  }

  /** Members who appear in the gallery share list — compare ids as strings (API may mix formats). */
  public getItemEligibleMembers(): Account[] {
    const allowed = new Set((this.gallerySharedWith || []).map((id) => String(id)));
    return (this.otherMembers || []).filter((m) => m.id != null && allowed.has(String(m.id)));
  }

  /**
   * Two accounts can share the same first/last name (different emails / user ids).
   * When that happens, append email so chips are distinguishable.
   */
  memberDisplayName(member: Account): string {
    const base = [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'Member';
    const norm = base.toLowerCase();
    const sameNameCount = (this.otherMembers || []).filter((m) => {
      const n = [m.firstName, m.lastName].filter(Boolean).join(' ').trim().toLowerCase();
      return n === norm;
    }).length;
    if (sameNameCount > 1 && member.email) {
      return `${base} (${member.email})`;
    }
    return base;
  }

  public setItemShareCategory(item: GalleryItem, mode: 'owner-only' | 'all-shared' | 'specific'): void {
    if (!item.id) return;
    /** When leaving "all shared" UI, never PATCH specific + [] — that hides the item from everyone. */
    let specificSharedWith: string[] = [];
    if (mode === 'specific') {
      const existing = (item.sharedWith || []).map(String).filter(Boolean);
      const wasAllSharedUi = this.getItemShareMode(item) === 'all-shared';
      if (existing.length > 0) {
        specificSharedWith = existing;
      } else if (wasAllSharedUi && this.gallerySharedWith.length > 0) {
        specificSharedWith = this.gallerySharedWith.map(String);
      }
    }
    const payload =
      mode === 'specific'
        ? { shareMode: 'specific' as const, sharedWith: specificSharedWith }
        : mode === 'owner-only'
          ? { shareMode: 'owner-only' as const, sharedWith: [] as string[] }
          : { shareMode: 'all-shared' as const, sharedWith: [] as string[] };
    this.galleryService.updateItemSharing(item.id, payload).subscribe({
      next: (updated) => {
        item.shareMode = (updated.shareMode || mode) as GalleryItem['shareMode'];
        item.sharedWith = (updated.sharedWith || payload.sharedWith || []).map((id) => String(id));
        item.shareWithAllGalleryMembers = !!updated.shareWithAllGalleryMembers;
      },
      error: () => this.alertService.error('Failed to update sharing for this item.')
    });
  }

  public toggleItemShareWith(item: GalleryItem, member: Account): void {
    if (!item.id || !member.id) return;
    const mid = String(member.id);
    const cur = (item.sharedWith || []).map(String);
    const next = cur.includes(mid) ? cur.filter((id) => id !== mid) : [...cur, mid];
    this.galleryService.updateItemSharing(item.id, { shareMode: 'specific', sharedWith: next }).subscribe({
      next: (updated) => {
        item.shareMode = updated.shareMode || 'specific';
        item.sharedWith = (updated.sharedWith || next).map((id) => String(id));
        item.shareWithAllGalleryMembers = !!updated.shareWithAllGalleryMembers;
      },
      error: () => this.alertService.error('Failed to update member access for this item.')
    });
  }

  setOnlyMe(only: boolean): void {
    this.onlyMe = only;
    const payload = only ? { gallerySharedWith: [] } : { gallerySharedWith: this.gallerySharedWith };
    this.galleryService.updateSettings({ galleryVisibility: 'private', ...payload }).subscribe();
  }

  isSharedWith(accountId: string): boolean {
    const id = String(accountId);
    return this.gallerySharedWith.some((x) => String(x) === id);
  }

  toggleShareWith(member: Account): void {
    if (!member.id) return;
    const id = String(member.id);
    if (this.gallerySharedWith.some((x) => String(x) === id)) {
      this.gallerySharedWith = this.gallerySharedWith.filter((m) => String(m) !== id);
    } else {
      this.gallerySharedWith = [...this.gallerySharedWith, id];
    }
    this.galleryService.updateSettings({
      galleryVisibility: 'private',
      gallerySharedWith: this.gallerySharedWith
    }).subscribe();
  }
}
