import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { GalleryService } from '@app/_services/gallery.service';
import { GalleryModalComponent, GalleryModalData } from './gallery-modal.component';

@Component({
  selector: 'app-gallery-section',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './gallery-section.component.html',
  styleUrls: ['./gallery-section.component.scss']
})
export class GallerySectionComponent implements OnInit {
  @Input() accountId!: string;
  @Input() isOwnProfile = false;
  /** 'tab' = render as a tab in the profile card tab row; 'link' = standalone link (default) */
  @Input() displayMode: 'tab' | 'link' = 'link';

  /** Number of items in my/their gallery (null while loading). */
  itemCount: number | null = null;
  /** Total items in galleries shared with me (only when isOwnProfile; null while loading). */
  sharedItemCount: number | null = null;

  constructor(
    private galleryService: GalleryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadItemCount();
    if (this.isOwnProfile) {
      this.loadSharedItemCount();
    }
  }

  loadItemCount(): void {
    if (!this.accountId) return;
    const req = this.isOwnProfile
      ? this.galleryService.getMyGallery()
      : this.galleryService.getGalleryForAccount(this.accountId);
    req.subscribe({
      next: (list) => {
        this.itemCount = (list || []).length;
      },
      error: () => {
        this.itemCount = 0;
      }
    });
  }

  loadSharedItemCount(): void {
    this.galleryService.getSharedWithMeTotalItems().subscribe({
      next: (res) => {
        this.sharedItemCount = res?.totalItems ?? 0;
      },
      error: () => {
        this.sharedItemCount = 0;
      }
    });
  }

  openGalleryModal(): void {
    const data: GalleryModalData = {
      accountId: this.accountId,
      isOwnProfile: this.isOwnProfile
    };
    const ref = this.dialog.open(GalleryModalComponent, {
      data,
      width: '95vw',
      maxWidth: '1440px',
      /* Move dialog down by 40px from the top and keep a stable height so the inner scroll area works. */
      position: { top: '40px' },
      height: 'calc(90vh - 40px)',
      maxHeight: 'calc(90vh - 40px)',
      panelClass: 'gallery-modal-panel'
    });
    ref.afterClosed().subscribe(() => {
      this.loadItemCount();
      if (this.isOwnProfile) {
        this.loadSharedItemCount();
      }
    });
  }
}
