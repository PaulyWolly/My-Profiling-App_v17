import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Account } from '@app/_models';
import { CurvedBorderComponent } from '@app/shared/curved-border/curved-border.component';
import { CustomTooltipDirective } from '@app/shared/custom-tooltip/custom-tooltip.directive';
import { MatDialog } from '@angular/material/dialog';
import { MapDialogComponent } from '@app/profile/components/map-dialog/map-dialog.component';
import { ChatDockComponent } from '../../chat/chat-dock/chat-dock.component';
import { ChatService, OnlineUser } from '@app/_services/chat.service';
import { AccountService } from '@app/_services/account.service';

@Component({
  selector: 'app-new-social-media-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CurvedBorderComponent,
    CustomTooltipDirective,
    ChatDockComponent
  ],
  templateUrl: './new-social-media-profile.component.html',
  styleUrls: ['./new-social-media-profile.component.scss']
})
export class NewSocialMediaProfileComponent implements OnInit {
  @Input() profile!: Account;
  @Input() isOwnProfile: boolean = false;

  loading = false;

  // Chat dock properties
  showChatList = false;
  onlineUsersCount = 0;
  pendingChats = false;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private chatService: ChatService,
    private accountService: AccountService
  ) {}

  ngOnInit() {
    // Subscribe to online users for chat dock
    this.chatService.getOnlineUsers().subscribe((users: OnlineUser[]) => {
      this.onlineUsersCount = users.length;
    });
    // Subscribe to pending chat requests for yellow LED
    this.chatService.getPendingChatRequests().subscribe(set => {
      this.pendingChats = set && set.size > 0;
    });
  }

  onImageLoaded() {
    this.loading = false;
  }

  onImageError() {
    this.loading = false;
  }

  /** Use AccountService so resolution matches Business profile and Edit (handles path/imageUrl, full URL for Render). */
  getFollowerImageUrl(follower: { imageUrl?: string; path?: string }): string {
    const url = this.accountService.getFollowerImageUrl(follower);
    return url || 'assets/images/default-avatar.svg';
  }

  /** Resolve main profile image to full URL so it loads on Render. */
  getProfileImageUrl(): string {
    return this.profile?.profileImage ? this.accountService.getProfileImageUrl(this.profile.profileImage) : '';
  }

  openMapDialog() {
    this.dialog.open(MapDialogComponent, {
      width: '600px',
      data: {
        address: this.profile?.address || '',
        city: this.profile?.city || '',
        state: this.profile?.state || '',
        zipCode: this.profile?.zipCode || ''
      }
    });
  }

  toggleChatList() {
    this.showChatList = !this.showChatList;
  }
}
