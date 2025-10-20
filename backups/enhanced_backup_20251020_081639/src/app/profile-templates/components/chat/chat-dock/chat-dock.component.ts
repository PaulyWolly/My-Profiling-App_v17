import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, NgZone, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatService, OnlineUser } from '@app/_services/chat.service';
import { Observable, take } from 'rxjs';
import { MinimizedChatComponent } from '../minimized-chat/minimized-chat.component';

@Component({
  selector: 'app-chat-dock',
  templateUrl: './chat-dock.component.html',
  styleUrls: ['./chat-dock.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MinimizedChatComponent
  ]
})
export class ChatDockComponent implements OnInit, OnDestroy {
  @Input() dockOpen = false;
  @Output() closeDock = new EventEmitter<void>();
  
  onlineUsers$!: Observable<OnlineUser[]>;
  activeChats$!: Observable<OnlineUser[]>;
  activeChatId$!: Observable<string | null>;
  minimizedChats: OnlineUser[] = [];
  private allChats: OnlineUser[] = [];
  private currentActiveChatId: string | null = null;
  private minimizedChatIdsSub: any;
  pendingChatRequests: Set<string> = new Set();
  private pendingChatRequestsSub: any;

  constructor(
    private chatService: ChatService,
    public cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {

    // Get streams from chat service
    this.onlineUsers$ = this.chatService.getOnlineUsers();
    this.activeChats$ = this.chatService.getActiveChats();
    this.activeChatId$ = this.chatService.getActiveChatId();

    // Keep allChats in sync
    this.activeChats$.subscribe(chats => {
      this.allChats = chats || [];
    });

    this.activeChatId$.subscribe(id => {
      this.currentActiveChatId = id;
    });

    this.minimizedChatIdsSub = this.chatService.getMinimizedChatIds().subscribe(ids => {
      // Defensive: only include chats with valid user objects
      this.minimizedChats = this.allChats.filter(chat => ids.includes(chat.id) && chat && chat.name);
      console.log('minimizedChats', this.minimizedChats);
      this.cdr.detectChanges();
    });

    this.pendingChatRequestsSub = this.chatService.getPendingChatRequests().subscribe(set => {
      this.pendingChatRequests = set;
      this.cdr.detectChanges();
    });
    
  }

  startChat(user: OnlineUser) {
    this.chatService.startChat(user.id);
    this.chatService.openChatDialog(user);
    this.closeDock.emit(); // Notify parent to close the dock
  }

  maximizeChat(userId: string) {
    this.chatService.setActiveChatId(userId);
    this.chatService.unminimizeChat(userId);
    const user = this.allChats.find(u => u.id === userId);
    if (user) {
      const dialogRef = this.chatService.openChatDialog(user);
      // Force refresh and scroll after dialog opens
      if (dialogRef && dialogRef.componentInstance && dialogRef.componentInstance.refreshMessages) {
        setTimeout(() => {
          dialogRef.componentInstance.refreshMessages({ stopPropagation: () => {} } as Event);
          dialogRef.componentInstance.shouldScrollToBottom = true;
        }, 0);
      }
    }
  }

  closeChat(userId: string) {
    this.chatService.closeChat(userId);
    this.chatService.unminimizeChat(userId);
  }

  ngOnDestroy() {
    if (this.minimizedChatIdsSub) this.minimizedChatIdsSub.unsubscribe();
    if (this.pendingChatRequestsSub) this.pendingChatRequestsSub.unsubscribe();
  }

  get hasPendingChats(): boolean {
    return this.pendingChatRequests && this.pendingChatRequests.size > 0;
  }
} 