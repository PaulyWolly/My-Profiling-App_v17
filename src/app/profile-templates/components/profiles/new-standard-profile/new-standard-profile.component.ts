import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Account } from '@app/_models';
import { AccountService } from '@app/_services';
import { MatDialog } from '@angular/material/dialog';
import { MapDialogComponent } from '@app/profile/components/map-dialog/map-dialog.component';
import { Subscription, delay, retryWhen, take } from 'rxjs';
import { CurvedBorderComponent } from '@app/shared/curved-border/curved-border.component';
import { ChatDockComponent } from '../../chat/chat-dock/chat-dock.component';
import { ChatService, OnlineUser } from '@app/_services/chat.service';
import { CustomTooltipDirective } from '@app/shared/custom-tooltip/custom-tooltip.directive';

@Component({
    selector: 'app-new-standard-profile',
    templateUrl: './new-standard-profile.component.html',
    styleUrls: ['./new-standard-profile.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDividerModule,
        MatDialogModule,
        CurvedBorderComponent,
        ChatDockComponent,
        CustomTooltipDirective
    ]
})
export class NewStandardProfileComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;
    @ViewChild(ChatDockComponent) chatDock?: ChatDockComponent;

    @Input() profile!: Account;
    @Input() isPreview: boolean = false;
    @Input() isOwnProfile: boolean = false;

    loading = true;
    private accountSubscription?: Subscription;
    private maxRetries = 3;
    private retryCount = 0;

    // Chat dock properties
    showChatList = false;
    onlineUsersCount = 0;
    pendingChats = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private dialog: MatDialog,
        private cdRef: ChangeDetectorRef,
        private chatService: ChatService
    ) {
        this.route.queryParams.subscribe(params => {
            if (params['preview'] === 'true') {
                this.isPreview = true;
            }
        });
    }

    ngOnInit() {
        console.log('NewStandardViewComponent ngOnInit');
        this.loadProfileData();
        // Subscribe to online users for chat dock
        this.chatService.getOnlineUsers().subscribe((users: OnlineUser[]) => {
            this.onlineUsersCount = users.length;
            this.cdRef.detectChanges();
        });
        // Subscribe to pending chat requests for yellow LED
        this.chatService.getPendingChatRequests().subscribe(set => {
            this.pendingChats = set && set.size > 0;
            this.cdRef.detectChanges();
        });
    }

    private loadProfileData() {
        if (!this.profile) {
            this.loading = true;
            this.accountSubscription = this.accountService.account$
                .pipe(
                    retryWhen(errors =>
                        errors.pipe(
                            delay(1000), // Wait 1 second between retries
                            take(this.maxRetries) // Maximum number of retries
                        )
                    )
                )
                .subscribe({
                    next: (account) => {
                        if (account) {
                            this.profile = account;
                            this.loading = false;
                            this.retryCount = 0; // Reset retry count on success
                        } else if (this.retryCount < this.maxRetries) {
                            // If no account and haven't exceeded retries, try to get account by ID
                            this.retryCount++;
                            const currentUser = this.accountService.accountValue;
                            if (currentUser?.id) {
                                this.accountService.getById(currentUser.id).subscribe({
                                    next: (fullAccount) => {
                                        this.profile = fullAccount;
                                        this.loading = false;
                                    },
                                    error: (error) => {
                                        console.error('Error getting account by ID:', error);
                                        this.loading = false;
                                    }
                                });
                            } else {
                                this.loading = false;
                            }
                        } else {
                            this.loading = false;
                        }
                        this.cdRef.detectChanges();
                    },
                    error: (error) => {
                        console.error('Error getting account:', error);
                        this.loading = false;
                        this.cdRef.detectChanges();
                    }
                });
        } else {
            this.loading = false;
        }
    }

    retryLoading(): void {
        this.retryCount = 0; // Reset retry count
        this.loadProfileData();
    }

    ngAfterViewInit(): void {
        console.log('NewStandardViewComponent ngAfterViewInit');
        if (this.scrollContainer?.nativeElement) {
            const container = this.scrollContainer.nativeElement;
            setTimeout(() => {
                console.log('Scrolling container to top:', container);
                container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }, 0);
        } else {
            console.warn('Scroll container ElementRef not found.');
        }
    }

    /** Resolve profile image to full URL (API base + path) so it loads from the correct origin. */
    getProfileImageUrl(): string {
        if (!this.profile?.profileImage) return '';
        return this.accountService.getProfileImageUrl(this.profile.profileImage);
    }

    onImageError(event: any) {
        // Image failed to load - could set a fallback here if needed
    }

    onImageLoad(event: any) {
        // Image loaded successfully
    }

    ngOnDestroy() {
        console.log('NewStandardViewComponent ngOnDestroy');
        if (this.accountSubscription) {
            this.accountSubscription.unsubscribe();
        }
    }

    get hasAddress(): boolean {
        return !!(this.profile?.address && this.profile?.city && this.profile?.state);
    }

    get hasSocialLinks(): boolean {
        return !!(
            this.profile?.linkedin ||
            this.profile?.twitter ||
            this.profile?.github ||
            this.profile?.instagram ||
            this.profile?.facebook
        );
    }

    openMapDialog(): void {
        if (!this.profile) return;

        this.dialog.open(MapDialogComponent, {
            data: {
                address: this.profile.address || '',
                city: this.profile.city || '',
                state: this.profile.state || '',
                zipCode: this.profile.zipCode || ''
            }
        });
    }

    toggleChatList() {
        this.showChatList = !this.showChatList;
    }
}
