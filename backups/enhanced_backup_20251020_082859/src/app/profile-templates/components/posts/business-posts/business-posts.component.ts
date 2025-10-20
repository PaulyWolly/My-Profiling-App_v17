import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Post } from '../../../models/post.interface';
import samplePosts from '../../../data/sample-posts.json';
import { AccountService } from '@app/_services/account.service';
import { Role } from '@app/_models/role';
import { PostService } from '@app/_services/post.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-business-posts',
  templateUrl: './business-posts.component.html',
  styleUrls: ['./business-posts.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class BusinessPostsComponent implements OnInit, OnChanges {
  @Input() posts: any[] = [];
  @Input() profileImage: string = '';
  @Input() loggedInUserName: string = '';
  @Output() respondToPost = new EventEmitter<any>();
  defaultAvatar: string = 'assets/images/default-avatar.svg';
  Role = Role;
  isSuperAdmin: boolean = false;

  constructor(private cdr: ChangeDetectorRef, private accountService: AccountService, private postService: PostService, private dialog: MatDialog, private snackBar: MatSnackBar) {
    this.isSuperAdmin = this.accountService.accountValue?.role === Role.SuperAdmin;
  }

  ngOnInit() {
    console.log('BusinessPostsComponent initialized with posts:', this.posts);
    // For now, load from sample data
    // this.posts = samplePosts.posts;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['posts']) {
      console.log('Posts changed:', this.posts);
      this.cdr.detectChanges();
    }
  }

  getResponseCount(post: any): number {
    // Count all posts that are responses to this post
    return this.posts.filter(p => p.respondingTo === post.id).length;
  }

  onLike(post: Post) {
    this.postService.likePost(post.id.toString()).subscribe({
      next: (res) => {
        post.likes = res.likes;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to like post:', err);
        this.snackBar.open('Failed to like post: ' + (err.error?.message || err.message), 'Close', { duration: 4000, panelClass: 'snackbar-error' });
      }
    });
  }

  onComment(post: Post) {
    // Emit the post data to parent component
    this.respondToPost.emit(post);
  }

  onShare(post: Post) {
    this.postService.sharePost(post.id.toString()).subscribe({
      next: (res) => {
        post.shares = res.shares;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to share post:', err);
        this.snackBar.open('Failed to share post: ' + (err.error?.message || err.message), 'Close', { duration: 4000, panelClass: 'snackbar-error' });
      }
    });
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }

  getProfileImageUrl(path: string): string {
    return this.accountService.getProfileImageUrl(path);
  }

  getDefaultAvatar(): string {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRTVFN0VCIi8+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA4MEMyMCA2NS42NDA2IDMyLjY0MDYgNTMgNDcgNTNINjNDNzcuMzU5NCA1MyA5MCA2NS42NDA2IDkwIDgwVjEwMEgyMFY4MFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';
  }

  onImageError(event: any, user: any): void {
    console.log('[BusinessPosts] Image loading error for user:', user?.firstName, user?.lastName);
    // Set the src to default avatar when image fails to load
    event.target.src = this.getDefaultAvatar();
  }

  onDelete(post: Post) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Post',
        message: 'Are you sure you want to delete this post? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.postService.deletePost(post.id.toString()).subscribe({
          next: () => {
            this.posts = this.posts.filter(p => p.id !== post.id);
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error('Failed to delete post:', err);
            this.snackBar.open('Failed to delete post: ' + (err.error?.message || err.message), 'Close', { duration: 5000, panelClass: 'snackbar-error' });
          }
        });
      }
    });
  }
}
