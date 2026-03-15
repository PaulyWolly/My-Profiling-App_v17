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
      this.galleryService.getSettings().subscribe(s => {
        this.gallerySharedWith = s.gallerySharedWith || [];
        this.onlyMe = (s.gallerySharedWith?.length ?? 0) === 0;
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
        this.otherMembers = (accounts || []).filter(a => a.id && a.id !== myId);
        this.loadingMembers = false;
      },
      error: () => { this.loadingMembers = false; }
    });
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
        this.items = list || [];
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

  setOnlyMe(only: boolean): void {
    this.onlyMe = only;
    const payload = only ? { gallerySharedWith: [] } : { gallerySharedWith: this.gallerySharedWith };
    this.galleryService.updateSettings({ galleryVisibility: 'private', ...payload }).subscribe();
  }

  isSharedWith(accountId: string): boolean {
    return this.gallerySharedWith.some(id => id === accountId);
  }

  toggleShareWith(member: Account): void {
    if (!member.id) return;
    const id = member.id;
    if (this.gallerySharedWith.includes(id)) {
      this.gallerySharedWith = this.gallerySharedWith.filter(m => m !== id);
    } else {
      this.gallerySharedWith = [...this.gallerySharedWith, id];
    }
    this.galleryService.updateSettings({
      galleryVisibility: 'private',
      gallerySharedWith: this.gallerySharedWith
    }).subscribe();
  }
}
