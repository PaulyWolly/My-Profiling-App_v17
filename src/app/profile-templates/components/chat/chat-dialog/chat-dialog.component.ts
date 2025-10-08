import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, AfterViewInit, Inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ChatService, OnlineUser, ChatMessage } from '@app/_services/chat.service';
import { AccountService } from '@app/_services/account.service';
import { Subscription } from 'rxjs';
import { environment } from '@environments/environment';
import { CustomTooltipDirective } from '@app/shared/custom-tooltip/custom-tooltip.directive';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

interface ChatDialogData {
  user: OnlineUser;
  isInitialPopup?: boolean;
}

@Component({
  selector: 'app-chat-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatBadgeModule,
    ScrollingModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="chat-window" [class.minimized]="isMinimized" [style.height]="isMinimized ? '64px' : '600px'">
      <div class="chat-header" (click)="toggleMinimize()">
        <div class="user-info">
          <img [src]="data.user.profileImage" [alt]="data.user.name" class="user-avatar">
          <span class="user-name">{{ data.user.name }}</span>
          <span class="online-status online" *ngIf="data.isInitialPopup"></span>
          <span *ngIf="isMinimized && hasNewMessages"
                matBadge="●"
                matBadgeColor="accent"
                matBadgeSize="small"
                class="minimized-badge">
          </span>
        </div>
        <div class="header-actions">
          <ng-container *ngIf="!isMinimized">
            <button class="icon-btn"
                    (click)="refreshMessages($event)"
                    [matBadge]="hasNewMessages ? '●' : ''"
                    [matBadgeColor]="'primary'"
                    [matBadgeSize]="'small'"
                    title="Refresh chat"
                  >
              <span class="icon-circle"><i class="fa fa-sync"></i></span>
            </button>
            <button class="icon-btn" (click)="clearChatView($event)" title="Clear chat view">
              <span class="icon-circle"><i class="fa fa-ban"></i></span>
            </button>
            <button class="icon-btn" (click)="minimize($event)" [title]="isMinimized ? 'Maximize chat view' : 'Minimize chat view'">
              <span class="icon-circle">
                <i class="fa" [ngClass]="isMinimized ? 'fa-plus' : 'fa-minus'"></i>
              </span>
            </button>
          </ng-container>
          <button class="icon-btn" (click)="close($event)" title="Close chat">
            <span class="icon-circle"><i class="fa fa-times"></i></span>
          </button>
        </div>
      </div>

      <div class="chat-body" [class.hidden]="isMinimized">
        <div class="messages" #messageContainer>
          <div *ngFor="let message of messages"
               class="message"
               [ngClass]="{'sent': message.senderId === currentUserId, 'received': message.senderId !== currentUserId}">
            <ng-container *ngIf="message.senderId !== currentUserId; else sentMessage">
              <img class="received-avatar" [src]="data.user.profileImage" alt="Sender" />
              <div class="received-content">
                <div class="received-time">{{ message.timestamp | date:'shortTime' }}</div>
                <div class="received-text">{{ message.content }}</div>
              </div>
            </ng-container>
            <ng-template #sentMessage>
              <div class="sent-content">
                <div class="sent-time">{{ message.timestamp | date:'shortTime' }}</div>
                <div class="sent-text">{{ message.content }}</div>
              </div>
              <img class="sent-avatar" [src]="currentUserProfileImage" alt="You" />
            </ng-template>
          </div>
        </div>
        <button *ngIf="newMessageArrived" class="new-message-badge" (click)="scrollToBottomAndClear()">
          New message ↓
        </button>
        <div class="chat-input">
          <mat-form-field appearance="outline">
            <input matInput
                   [(ngModel)]="newMessage"
                   placeholder="Type a message..."
                   (keyup.enter)="sendMessage()">
          </mat-form-field>
          <button mat-icon-button type="button" (click)="showEmojiPicker = !showEmojiPicker" [attr.aria-label]="'Add emoji'">
            <mat-icon>emoji_emotions</mat-icon>
          </button>
          <emoji-picker *ngIf="showEmojiPicker" (emoji-click)="addEmoji($event)" style="position: absolute; bottom: 60px; right: 20px; z-index: 1000;"></emoji-picker>
          <button mat-icon-button color="primary" (click)="sendMessage()" [disabled]="!newMessage.trim()">
            <mat-icon>send</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./chat-dialog.component.scss']
})
export class ChatDialogComponent implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {
  @ViewChild(CdkVirtualScrollViewport) private viewport!: CdkVirtualScrollViewport;
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  currentUserId: string;
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isMinimized: boolean = false;
  hasNewMessages: boolean = false;
  private messageSubscription?: Subscription;
  private lastSeenMessageId: string | null = null;
  private lastMessageCount: number = 0;
  currentUserProfileImage: string = '';
  private scrollTimeout: any;
  newMessageArrived: boolean = false;
  isAtBottom: boolean = true;
  shouldScrollToBottom: boolean = false;
  showEmojiPicker = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ChatDialogData,
    private dialogRef: MatDialogRef<ChatDialogComponent>,
    private chatService: ChatService,
    private accountService: AccountService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {
    this.currentUserId = this.accountService.accountValue?.id || '';
  }

  ngOnInit() {
    console.log('[ChatDialog] Initializing with user:', this.data.user);

    // Reset state
    this.isMinimized = false;
    this.messages = [];
    this.hasNewMessages = false;
    this.lastSeenMessageId = null;
    this.lastMessageCount = 0;

    if (!this.currentUserId) {
      console.error('[ChatDialog] No current user ID available');
      return;
    }

    // Ensure profile image URL is properly formatted
    if (this.data.user.profileImage) {
      this.data.user.profileImage = this.data.user.profileImage.startsWith('http')
        ? this.data.user.profileImage
        : `${environment.apiUrl}/${this.data.user.profileImage}`;
    }

    const profileImage = this.accountService.accountValue?.profileImage;
    this.currentUserProfileImage = profileImage
      ? (profileImage.startsWith('http') ? profileImage : `${environment.apiUrl}/${profileImage}`)
      : 'assets/images/default-avatar.svg';

    // Subscribe to messages
    this.subscribeToMessages();
    // Always fetch latest messages from server when dialog opens
    setTimeout(() => this.refreshMessages({ stopPropagation: () => {} } as Event), 0);

    // Add window focus listener
    window.addEventListener('focus', this.onWindowFocus);

    // Mark all messages as read and clear pending notification
    if (this.currentUserId && this.data.user.id) {
      this.chatService.markChatAsRead(this.data.user.id, this.currentUserId).subscribe(() => {
        this.chatService['removePendingRequest'](this.data.user.id);
      });
    }
  }

  ngAfterViewInit() {
    this.updateDialogContainerClass();
    // Initial scroll to bottom
    this.scrollToBottom();
    // Listen for scroll events
    if (this.messageContainer && this.messageContainer.nativeElement) {
      this.messageContainer.nativeElement.addEventListener('scroll', this.handleScroll, { passive: true });
    }
  }

  ngAfterViewChecked() {
    // Only scroll if we're at the bottom or if we just loaded new data
    if (this.shouldScrollToBottom) {
      this.forceScrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    console.log('[ChatDialog] Destroying dialog for user:', this.data.user.id);

    // Cleanup subscriptions
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    // Remove window focus listener
    window.removeEventListener('focus', this.onWindowFocus);

    // Clear any pending timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    if (this.messageContainer && this.messageContainer.nativeElement) {
      this.messageContainer.nativeElement.removeEventListener('scroll', this.handleScroll);
    }
  }

  private handleScroll = () => {
    if (!this.messageContainer || !this.messageContainer.nativeElement) return;
    const el = this.messageContainer.nativeElement;
    const threshold = 40; // px from bottom
    this.isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (this.isAtBottom) {
      this.newMessageArrived = false;
    }
  }

  private scrollToBottom(): void {
    if (this.messageContainer && this.messageContainer.nativeElement) {
      if (this.isAtBottom) {
        if (this.scrollTimeout) {
          clearTimeout(this.scrollTimeout);
        }
        this.scrollTimeout = setTimeout(() => {
          this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
        }, 0);
      }
    }
  }

  private isScrolledToBottom(): boolean {
    if (!this.viewport) return true;
    const renderedRange = this.viewport.getRenderedRange();
    const total = this.viewport.getDataLength();
    // If the last rendered index is the last message, we're at the bottom
    return renderedRange.end >= total;
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.updateDialogContainerClass();
    if (!this.isMinimized) {
      this.hasNewMessages = false;
      if (this.messages.length > 0) {
        this.lastSeenMessageId = this.messages[this.messages.length - 1].id || null;
      }
      // Scroll to bottom when restoring from minimized state
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  minimize(event: MouseEvent) {
    event.stopPropagation();
    // Notify the dock to minimize this chat
    this.chatService.minimizeChat(this.data.user.id);
    // Close the dialog
    this.dialogRef.close();
  }

  updateDialogContainerClass() {
    // Find the overlay pane for this dialog
    const panes = document.querySelectorAll('.cdk-overlay-pane.chat-dialog-container');
    panes.forEach(pane => {
      if (this.isMinimized) {
        pane.classList.add('minimized');
      } else {
        pane.classList.remove('minimized');
      }
    });
  }

  close(event: Event) {
    event.stopPropagation();
    console.log('[ChatDialog] Closing dialog for user:', this.data.user.id);
    this.dialogRef.close();
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;

    console.log(`[ChatDebug][Dialog] Sending message from ${this.currentUserId} to ${this.data.user.id}`);
    const message: ChatMessage = {
      content: this.newMessage.trim(),
      senderId: this.currentUserId,
      recipientId: this.data.user.id,
      timestamp: new Date()
    };

    console.log('[ChatDebug][Dialog] Message object:', message);
    this.chatService.sendMessage(message).subscribe({
      next: (sentMessage) => {
        console.log('[ChatDebug][Dialog] Message sent successfully:', sentMessage);
        this.newMessage = '';
        setTimeout(() => {
          this.refreshMessages({ stopPropagation: () => {} } as Event);
          this.shouldScrollToBottom = true;
        }, 0);
      },
      error: (error) => {
        console.error('[ChatDebug][Dialog] Error sending message:', error);
      }
    });
  }

  private onScroll() {
    if (this.isScrolledToBottom()) {
      this.hasNewMessages = false;
      if (this.messages.length > 0) {
        this.lastSeenMessageId = this.messages[this.messages.length - 1].id || null;
      }
    }
  }

  private subscribeToMessages() {
    if (!this.currentUserId || !this.data.user.id) {
      console.error('[ChatDebug][Dialog] Missing user IDs for chat');
      return;
    }

    const chatId = [this.currentUserId, this.data.user.id].sort().join('-');
    console.log(`[ChatDebug][Dialog] Subscribing to messages for chatId: ${chatId}`);
    this.messageSubscription = this.chatService
      .getMessages(this.currentUserId, this.data.user.id)
      .subscribe({
        next: (messages) => {
          console.log('[ChatDebug][Dialog] Received messages update:', messages);
          // Detect new message
          if (this.messages.length > 0 && messages.length > this.messages.length && !this.isAtBottom) {
            this.newMessageArrived = true;
          }
          this.messages = messages;
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('[ChatDebug][Dialog] Error receiving messages:', error);
        }
      });
  }

  clearChatView(event: Event) {
    event.stopPropagation();
    console.log('[ChatDebug][Dialog] Clearing chat view for this session');
    this.messages = [];
  }

  private forceScrollToBottom(): void {
    if (this.messageContainer && this.messageContainer.nativeElement) {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = setTimeout(() => {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }, 0);
    }
  }

  refreshMessages(event: Event) {
    event.stopPropagation();
    this.hasNewMessages = false;
    if (this.messages.length > 0) {
      this.lastSeenMessageId = this.messages[this.messages.length - 1].id || null;
    }
    // Force a refresh of messages from the server
    this.chatService.refreshMessages(this.currentUserId, this.data.user.id).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      }
    });
  }

  onWindowFocus = () => {
    this.refreshMessages({ stopPropagation: () => {} } as Event);
  }

  scrollToBottomAndClear() {
    this.newMessageArrived = false;
    this.scrollToBottom();
  }

  addEmoji(event: any) {
    this.newMessage += event.detail.unicode;
    this.showEmojiPicker = false;
  }
}
