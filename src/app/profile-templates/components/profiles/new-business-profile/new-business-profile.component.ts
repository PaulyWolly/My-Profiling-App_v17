import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Account } from '@app/_models';
import { MatDialog } from '@angular/material/dialog';
import { MapDialogComponent } from '@app/profile/components/map-dialog/map-dialog.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BusinessPostsComponent } from '../../posts/business-posts/business-posts.component';
import { StarRatingComponent } from '../../star-rating/star-rating.component';
import { AccountService } from '@app/_services/account.service';
import { CreatePostDialogComponent } from '../../posts/create-post-dialog/create-post-dialog.component';
import { PostService } from '@app/_services/post.service';
import { ChatService, OnlineUser } from '@app/_services/chat.service';
import { ChatDialogComponent } from '../../chat/chat-dialog/chat-dialog.component';
import { ChatDockComponent } from '../../chat/chat-dock/chat-dock.component';
import { Observable } from 'rxjs';
import { ImageService } from '@app/_services/image.service';
import { CustomTooltipDirective } from 'src/app/shared/custom-tooltip/custom-tooltip.directive';

@Component({
  selector: 'app-new-business-profile',
  templateUrl: './new-business-profile.component.html',
  styleUrls: ['./new-business-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule,
    MatSnackBarModule,
    BusinessPostsComponent,
    StarRatingComponent,
    ChatDockComponent,
    CustomTooltipDirective
  ],
  providers: [ChatDialogComponent]
})
export class NewBusinessProfileComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() profile!: Account;
  @Input() isOwnProfile: boolean = false;

  imageLoading: boolean = true;
  companyLogoLoading: boolean = false;
  selectedTabIndex = 0;
  syncedTabHeight: string | null = null;
  posts: any[] = [];
  isLoadingPosts: boolean = false;
  showChatList: boolean = false;
  onlineUsers: OnlineUser[] = [];
  onlineUsersCount: number = 0;

  @ViewChild('timelineContent') timelineContentRef!: ElementRef;
  @ViewChild('aboutContent') aboutContentRef!: ElementRef;

  profileRating: number = 4.5;
  users: any[] = [];

  activeChats$: Observable<any[]>;
  pendingChats = false;
  hasNewPosts: boolean = false;

  constructor(
    private dialog: MatDialog,
    private accountService: AccountService,
    private postService: PostService,
    private chatService: ChatService,
    private imageService: ImageService,
    private cdr: ChangeDetectorRef
  ) {
    this.activeChats$ = this.chatService.getActiveChats();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['profile']) {
      this.ensureImagesHaveFullUrls();
    }
    if (changes['profile'] && this.profile?.id) {
      this.loadPosts();
    }
  }

  ngOnInit() {
    this.imageLoading = !!this.profile?.profileImage;
    this.companyLogoLoading = !!this.profile?.companyLogo;
    this.loadUsers();
    this.ensureImagesHaveFullUrls();
    // Subscribe to pending chat requests for yellow LED
    this.chatService.getPendingChatRequests().subscribe(set => {
      this.pendingChats = set && set.size > 0;
      this.cdr.detectChanges();
    });
    // Subscribe to new post notifications
    this.chatService.onNewPost().subscribe(post => {
      // If the post is for this profile (recipient or sender), refresh posts immediately
      if (post && (post.recipient?.id === this.profile?.id || post.sender?.id === this.profile?.id)) {
        this.loadPosts();
      }
    });
    // Properly parse and set skills
    if (this.profile)
      this.setSkillsArray();

    if (this.profile?.id) {
      this.loadPosts();
      // Subscribe to online users after we have the profile
      this.chatService.getOnlineUsers().subscribe((users: OnlineUser[]) => {
        this.onlineUsers = users.filter(u => u.id !== this.profile.id);
        this.onlineUsersCount = this.onlineUsers.length;
        this.cdr.detectChanges();
      });
    }
  }

  private ensureImagesHaveFullUrls() {
    if (this.profile) {
      if (this.profile.profileImage) {
        // Use AccountService's formatImageUrl method instead of ImageService
        this.profile.profileImage = this.accountService['formatImageUrl'](this.profile.profileImage);
        console.log('[BusinessProfile] Formatted profile image URL:', this.profile.profileImage);
      }

      if (this.profile.companyLogo) {
        this.profile.companyLogo = this.accountService['formatImageUrl'](this.profile.companyLogo);
        console.log('[BusinessProfile] Formatted company logo URL:', this.profile.companyLogo);
      }
    }
  }

  getProfileImageUrl(): string {
    if (this.profile?.profileImage) {
      return this.profile.profileImage;
    }
    // Fallback to a data URL for a simple default avatar
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRTVFN0VCIi8+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA4MEMyMCA2NS42NDA2IDMyLjY0MDYgNTMgNDcgNTNINjNDNzcuMzU5NCA1MyA5MCA2NS42NDA2IDkwIDgwVjEwMEgyMFY4MFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncTabHeights(), 0);
  }

  /**
   * Handle window resize events to maintain proper scrolling
   */
  @HostListener('window:resize')
  onResize() {
    console.log('Window resize detected, updating tab heights');
    // Adjust tab heights when window is resized
    this.syncTabHeights();

    // Force scrollable content to update
    setTimeout(() => {
      if (this.timelineContentRef?.nativeElement) {
        this.timelineContentRef.nativeElement.style.overflowY = 'auto';
      }
      if (this.aboutContentRef?.nativeElement) {
        this.aboutContentRef.nativeElement.style.overflowY = 'auto';
      }
    }, 100);
  }

  onTabChange(event: MatTabChangeEvent) {
    this.selectedTabIndex = event.index;
    console.log('Tab changed to:', event.index);

    // If switching to Timeline tab, ensure posts are loaded
    if (event.index === 0 && this.profile?.id) {
      this.loadPosts();
    }

    setTimeout(() => this.syncTabHeights(), 0);
  }

  /**
   * Sets a consistent height for tab content areas to ensure scrolling works properly
   */
  syncTabHeights() {
    // Using a fixed height that fits the content well
    this.syncedTabHeight = '280px';

    // For Timeline tab
    if (this.timelineContentRef && this.timelineContentRef.nativeElement) {
      this.timelineContentRef.nativeElement.style.height = this.syncedTabHeight;
      this.timelineContentRef.nativeElement.style.overflowY = 'auto';
    }

    // For About tab
    if (this.aboutContentRef && this.aboutContentRef.nativeElement) {
      this.aboutContentRef.nativeElement.style.height = this.syncedTabHeight;
      // this.aboutContentRef.nativeElement.style.overflowY = 'auto';
    }

  }

  onImageLoaded() {
    this.imageLoading = false;
  }

  onImageError(event: any) {
    this.imageLoading = false;
    // Clear the profile image URL in case of error
    if (this.profile) {
      this.profile.profileImage = undefined;
    }
  }

  onCompanyLogoLoaded() {
    this.companyLogoLoading = false;
  }

  onCompanyLogoError() {
    this.companyLogoLoading = false;
    // Clear the company logo URL in case of error
    if (this.profile) {
      console.error('[BusinessCard] Error loading company logo');
      this.profile.companyLogo = undefined;
    }
  }

  // Open the map dialog with the profile address
  openMapDialog(): void {
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

  openCreatePostDialog(postToRespondTo?: any) {
    const senderId = this.profile?.id;
    if (!this.users || this.users.length === 0) {
      this.loadUsers();
      this._openCreatePostDialogWithUsers(senderId, postToRespondTo);
    } else {
      this._openCreatePostDialogWithUsers(senderId, postToRespondTo);
    }
  }

  private loadUsers() {
    this.accountService.getAll().subscribe({
      next: (users) => {
        this.users = users.map((u: any) => ({
          id: u.id,
          name: u.firstName + ' ' + u.lastName,
          profileImage: u.profileImage || ''
        }));
        console.log('Users for post dialog:', this.users);
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  private loadPosts() {
    if (!this.profile?.id) return;

    console.log('Loading posts for user:', this.profile.id);
    this.isLoadingPosts = true;
    this.postService.getPostsForUser(this.profile.id).subscribe({
      next: (posts) => {
        this.posts = posts;
        console.log('Posts loaded:', posts);
        this.isLoadingPosts = false;
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.isLoadingPosts = false;
        this.cdr.detectChanges();
      }
    });
  }

  private _openCreatePostDialogWithUsers(senderId: string, postToRespondTo?: any) {
    const dialogRef = this.dialog.open(CreatePostDialogComponent, {
      data: {
        users: this.users.filter(u => u.id !== senderId),
        senderId,
        respondingTo: postToRespondTo
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Find full recipient user data
        const recipientUser = this.users.find(u => u.id === result.recipientId);

        const newPost = {
          id: Date.now().toString(), // Temporary ID until server response
          sender: {
            id: this.profile.id,
            firstName: this.profile.firstName,
            lastName: this.profile.lastName,
            profileImage: this.profile.profileImage
          },
          recipient: {
            id: recipientUser?.id,
            firstName: recipientUser?.firstName,
            lastName: recipientUser?.lastName,
            profileImage: recipientUser?.profileImage
          },
          content: result.content,
          createdAt: new Date().toISOString(),
          respondingTo: result.respondingTo?.id,
          likes: 0,
          shares: 0
        };

        // Add the post immediately
        this.posts = [newPost, ...this.posts];
        this.cdr.detectChanges();

        // Then send to server
        this.postService.createPost({
          sender: senderId,
          recipient: result.recipientId,
          content: result.content,
          respondingTo: result.respondingTo?.id
        }).subscribe({
          next: (serverPost) => {
            // Update the post with server data while preserving local data if server doesn't provide it
            const index = this.posts.findIndex(p => p.id === newPost.id);
            if (index !== -1) {
              this.posts[index] = {
                ...newPost,
                ...serverPost,
                sender: { ...newPost.sender, ...serverPost.sender },
                recipient: { ...newPost.recipient, ...serverPost.recipient }
              };
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            console.error('Error creating post:', error);
            // Remove the temporary post if server request fails
            this.posts = this.posts.filter(p => p.id !== newPost.id);
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  startChat(user: OnlineUser) {
    this.showChatList = false;
    this.chatService.startChat(user.id);

    // Open the chat dialog for the sender immediately
    this.chatService.openChatDialog(user);
  }

  closeChat(userId: string) {
    this.chatService.closeChat(userId);
  }

  toggleChatList() {
    this.showChatList = !this.showChatList;
  }

  private loadOnlineUsers() {
    // Instead of loading all users, we'll use the already subscribed online users
    // The list is already filtered to exclude current user in the constructor
    this.showChatList = true;
    this.cdr.detectChanges();
  }

  /**
   * Formats a website URL to ensure it has the proper http/https prefix
   * @param url The website URL to format
   * @returns A properly formatted URL
   */
  formatWebsiteUrl(url: string): string {
    if (!url) return '';

    // If the URL already has http:// or https://, return it as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Otherwise, add https:// prefix
    return `https://${url}`;
  }

  /**
   * Gets debug information about skills
   * Helps track what's happening with skills for debugging
   */
  getDebugSkillsInfo(): string {
    if (!this.profile || !this.profile.skills) {
      return 'No skills found';
    }

    const skillsArray = this.profile.skills;

    if (!Array.isArray(skillsArray)) {
      return `Skills is not an array: ${typeof skillsArray}, value: ${String(skillsArray)}`;
    }

    if (skillsArray.length === 0) {
      return 'Skills array is empty';
    }

    return `Skills array has ${skillsArray.length} items: [${skillsArray.join(', ')}]`;
  }

  /**
   * Safely gets the skills array, handling any possible format
   * This method forcefully splits skills to ensure individual bubbles
   */
  getSkillsArray(): string[] {
    const defaultSkill = ['Enter a skill or skills to show here'];
    if (!this.profile || !this.profile.skills) {
      return defaultSkill;
    }
    let skillsString: string;
    if (Array.isArray(this.profile.skills)) {
      if (this.profile.skills.length === 0) {
        return defaultSkill;
      }
      skillsString = this.profile.skills.join(',');
    } else if (typeof this.profile.skills === 'string') {
      skillsString = this.profile.skills as string;
    } else {
      skillsString = String(this.profile.skills);
    }
    const processedSkills = skillsString
      .split(/[,;|]+/)
      .map(s => s.trim())
      .filter(s => s !== '');
    return processedSkills.length > 0 ? processedSkills : defaultSkill;
  }

  refreshPosts() {
    this.loadPosts();
    this.hasNewPosts = false;
    this.cdr.detectChanges();
  }

  private setSkillsArray() {
    if (this.profile) {
      console.log('Original skills:', this.profile.skills);

      // Convert skill string to array if it's a single string
      if (this.profile.skills && typeof this.profile.skills === 'string') {
        this.profile.skills = (this.profile.skills as string).split(',').map(skill => skill.trim());
        console.log('Skills after string conversion:', this.profile.skills);
      }

      // If skills is a single string in an array, split it
      if (this.profile.skills && Array.isArray(this.profile.skills) && this.profile.skills.length === 1
          && typeof this.profile.skills[0] === 'string' && this.profile.skills[0].includes(',')) {
        this.profile.skills = this.profile.skills[0].split(',').map(skill => skill.trim());
        console.log('Skills after splitting single array item:', this.profile.skills);
      }

      // If no skills or empty array, set default skills
      if (!this.profile.skills || this.profile.skills.length === 0) {
        this.profile.skills = [];
        console.log('No skills set for this user, leaving skills empty.');
      }

      // Ensure skills are always an array
      if (!Array.isArray(this.profile.skills)) {
        const skillsValue = this.profile.skills;
        this.profile.skills = typeof skillsValue === 'object' ?
          [JSON.stringify(skillsValue)] :
          [String(skillsValue)];
        console.log('Skills converted to array:', this.profile.skills);
      }
    }
  }

  get hasPendingChats(): boolean {
    return this.pendingChats && !this.showChatList;
  }
}
