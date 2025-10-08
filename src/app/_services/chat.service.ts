import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ChatDialogComponent } from '../profile-templates/components/chat/chat-dialog/chat-dialog.component';
import { AccountService } from './account.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ChatMessage {
  id?: string;
  content: string;
  senderId: string;
  recipientId: string;
  timestamp: Date;
}

export interface OnlineUser {
  id: string;
  name: string;
  profileImage?: string;
  isOnline?: boolean;
  sessionId?: string;
}

interface ChatRequest {
  type: string;
  sender: OnlineUser;
  recipientId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl + '/api/chat';
  private wsUrl = environment.wsUrl;
  private activeChats = new BehaviorSubject<OnlineUser[]>([]);
  private messageSubjects: { [key: string]: BehaviorSubject<ChatMessage[]> } = {};
  private onlineUsers = new BehaviorSubject<OnlineUser[]>([]);
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 5000; // 5 seconds
  private chatRequests = new Set<string>(); // Track pending chat requests
  private sessionId: string;
  private messageSubject = new Subject<ChatMessage>();
  private messageMap = new Map<string, ChatMessage[]>();
  private activeChatId = new BehaviorSubject<string | null>(null);
  private openChatDialogs: Map<string, MatDialogRef<ChatDialogComponent>> = new Map();
  private minimizedChatIds = new BehaviorSubject<string[]>([]);
  private pendingChatRequests = new BehaviorSubject<Set<string>>(new Set());
  private currentOpenChatId: string | null = null;
  private newPostSubject = new Subject<any>();

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private accountService: AccountService,
    private snackBar: MatSnackBar
  ) {
    // Generate a unique session ID for this browser tab
    this.sessionId = 'session_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
    this.initializeWebSocket();

    // Subscribe to account changes to handle login/logout
    this.accountService.account$.subscribe(account => {
      if (account) {
        const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token');
        if (token && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.connectWebSocket(token);
        }
      } else {
        // Cleanup on logout
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.onlineUsers.next([]);
        this.chatRequests.clear();
        this.closeAllChats();  // Close all active chat dialogs
        this.minimizedChatIds.next([]); // Clear minimized chats
        this.messageSubjects = {};  // Clear all message subjects
      }
    });

    // On service init, fetch unread chats for the current user
    const currentUserId = this.accountService.accountValue?.id;
    console.log('[ChatService] Fetching unread chats for user:', currentUserId);
    if (currentUserId) {
      this.getUnreadChats(currentUserId)
        .subscribe({
            next: unreadChats => {
              const newSet = new Set<string>();
              if (unreadChats && unreadChats.length > 0) {
                unreadChats.forEach(chat => newSet.add(chat.senderId));
              }
              this.pendingChatRequests.next(newSet);
            },
            error: err => {
              console.error('[ChatService] Error fetching unread chats:', err);
              this.pendingChatRequests.next(new Set());
            }
        });
    }
  }

  private initializeWebSocket() {
    const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token');
    if (token) {
      this.connectWebSocket(token);
    }
  }

  private connectWebSocket(token: string) {
    try {
      const wsUrl = `${this.wsUrl}?token=${token}&sessionId=${this.sessionId}`;
      console.log('Attempting WebSocket connection to:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connection established successfully');
        this.reconnectAttempts = 0;
        // Request any pending chat requests upon connection
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'get_pending_chat_requests'
          }));
        }
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        // Only clear online users for this session
        const currentUsers = this.onlineUsers.value;
        const filteredUsers = currentUsers.filter(u => u.sessionId !== this.sessionId);
        this.onlineUsers.next(filteredUsers);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.initializeWebSocket(), this.reconnectTimeout);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleWebSocketMessage(event: any) {
    try {
      const message = JSON.parse(event.data);
      console.log('[handleWebSocketMessage] Received message:', message);

      switch (message.type) {
        case 'online_users':
          this.handleOnlineUsersUpdate(message);
          break;
        case 'chat_message':
          // Handle all messages the same way, whether sent or received
          console.log('[handleWebSocketMessage] Processing message:', message);
          this.handleChatMessage(message);
          break;
        case 'chat_request':
          this.handleChatRequest(message);
          break;
        case 'pending_chat_requests':
          if (message.requests && Array.isArray(message.requests)) {
            message.requests.forEach((request: ChatRequest) => this.handleChatRequest(request));
          }
          break;
        case 'new_post':
          this.handleNewPostNotification(message.post);
          break;
      }
    } catch (error) {
      console.error('[handleWebSocketMessage] Error handling message:', error);
    }
  }

  private handleOnlineUsersUpdate(message: any) {
    const currentUserId = this.accountService.accountValue?.id;
    const filteredUsers = message.users
      .filter((user: OnlineUser) => user.id !== currentUserId)
      .map((user: OnlineUser) => ({
        ...user,
        profileImage: user.profileImage ?
          (user.profileImage.startsWith('http') ? user.profileImage : `${environment.apiUrl}/${user.profileImage}`)
          : null
      }));

    this.onlineUsers.next(filteredUsers);
  }

  private handleChatMessage(message: any) {
    console.log('[ChatDebug][Service] Processing message:', message);
    const msg = message.message;  // The actual message is nested in message.message
    console.log('[ChatDebug][Service] Message content:', msg);

    // Get current user ID
    const currentUserId = this.accountService.accountValue?.id;
    if (!currentUserId) {
      console.error('[ChatDebug][Service] No current user ID available');
      return;
    }

    // Create chat ID consistently by always sorting the IDs
    const participants = [msg.senderId, msg.recipientId].sort();
    const chatId = participants.join('-');
    console.log('[ChatDebug][Service] Chat ID:', chatId, 'Current user:', currentUserId);

    // Initialize message subject if it doesn't exist
    if (!this.messageSubjects[chatId]) {
      console.log('[ChatDebug][Service] Creating new message subject');
      this.messageSubjects[chatId] = new BehaviorSubject<ChatMessage[]>([]);
    }

    // Get current messages
    const currentMessages = this.messageSubjects[chatId].value;
    console.log('[ChatDebug][Service] Current messages:', currentMessages);

    // Check if message already exists to avoid duplicates
    if (!currentMessages.find(m => m.id === msg.id)) {
      console.log('[ChatDebug][Service] Adding new message to chat');
      const updatedMessages = [...currentMessages, msg];
      this.messageSubjects[chatId].next(updatedMessages);
    } else {
      console.log('[ChatDebug][Service] Message already exists in chat');
    }

    // If not in open/visible chat, add to pending/unread
    if (msg.recipientId === currentUserId && !this.isChatDialogOpen(msg.senderId)) {
      this.addPendingRequest(msg.senderId);
    }
  }

  private handleChatRequest(message: any) {
    const sender = message.sender;
    const currentUserId = this.accountService.accountValue?.id;
    const mySessionId = this.sessionId;

    console.log('[handleChatRequest] --- DEBUG INFO ---');
    console.log('Current user ID:', currentUserId);
    console.log('My session ID:', mySessionId);
    console.log('Sender ID:', sender.id);
    console.log('Recipient ID:', message.recipientId);
    console.log('Current openChatDialogs:', Array.from(this.openChatDialogs));
    console.log('isChatActive(sender.id):', this.isChatActive(sender.id));
    console.log('-----------------------------');

    // Only show notification if we are the recipient and NOT the sender
    if (message.recipientId !== currentUserId || sender.id === currentUserId) {
        console.log('[handleChatRequest] Not the intended recipient or is the sender. No ACCEPT alert will be shown.');
        return;
    }

    // Don't show duplicate notifications for the same sender
    if (this.chatRequests.has(sender.id)) {
        console.log('[handleChatRequest] Duplicate request from same sender');
        return;
    }

    // Do not show alert if chat dialog is already open with sender
    if (this.isChatDialogOpen(sender.id)) {
        console.log('[handleChatRequest] Chat dialog already open with sender, not showing alert');
        return;
    }

    this.chatRequests.add(sender.id);
    this.addPendingRequest(sender.id);
    console.log('[handleChatRequest] Added request to tracking set');

    // Show notification that stays until user action
    const snackBarRef = this.snackBar.open(
        `${sender.name} wants to chat with you`,
        'Accept',
        {
            duration: undefined, // Notification will stay until user action
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
            panelClass: ['chat-request-snackbar']
        }
    );

    snackBarRef.onAction().subscribe(() => {
        console.log('[handleChatRequest] User accepted chat request');
        this.chatRequests.delete(sender.id);
        this.removePendingRequest(sender.id);
        // Open the chat dialog and track it
        this.openChatDialog(sender);
    });

    snackBarRef.afterDismissed().subscribe(() => {
        console.log('[handleChatRequest] Chat request notification dismissed');
        this.chatRequests.delete(sender.id);
    });
  }

  getOnlineUsers(): Observable<OnlineUser[]> {
    return this.onlineUsers.asObservable();
  }

  startChat(userId: string): void {
    console.log('[ChatService] startChat called with:', userId);
    const user = this.onlineUsers.value.find(u => u.id === userId);
    console.log('[ChatService] user found:', user);
    if (!user) return;
    const currentChats = this.activeChats.value;
    if (!currentChats.find(chat => chat.id === userId)) {
      this.activeChats.next([...currentChats, user]);
    }
    this.setActiveChatId(userId);
  }

  closeChat(userId: string): void {
    const currentChats = this.activeChats.value;
    const updatedChats = currentChats.filter(chat => chat.id !== userId);
    this.activeChats.next(updatedChats);
    if (this.activeChatId.value === userId) {
      // If the closed chat was active, switch to another or null
      this.activeChatId.next(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
  }

  sendMessage(message: ChatMessage): Observable<ChatMessage> {
    console.log('[ChatDebug][Service][Send] Attempting to send message:', message);

    // Get the chat ID for this conversation
    const chatId = this.getChatId(message.senderId, message.recipientId);

    // Only send chat request if this is the first message in this chat
    if (!this.messageMap.has(chatId)) {
        console.log('[ChatDebug][Service][Send] First message in this chat, sending chat request');
        this.sendChatRequestIfNeeded(message.recipientId);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const wsMessage = {
            type: 'chat_message',
            recipientId: message.recipientId,
            content: message.content
        };
        console.log('[ChatDebug][Service][Send] Sending WebSocket message:', wsMessage);
        this.ws.send(JSON.stringify(wsMessage));

        // Add message to the local chat immediately
        console.log('[ChatDebug][Service][Send] Adding message to chat ID:', chatId);

        if (!this.messageSubjects[chatId]) {
            this.messageSubjects[chatId] = new BehaviorSubject<ChatMessage[]>([]);
        }

        const currentMessages = this.messageSubjects[chatId].value;
        const updatedMessages = [...currentMessages, message];
        this.messageSubjects[chatId].next(updatedMessages);
        this.messageMap.set(chatId, updatedMessages);

        return new Observable(subscriber => {
            subscriber.next(message);
            subscriber.complete();
        });
    } else {
        console.log('[ChatDebug][Service][Send] WebSocket not available, using HTTP fallback');
        return this.http.post<ChatMessage>(`${this.apiUrl}/messages`, message);
    }
  }

  getMessages(userId1: string, userId2: string): Observable<ChatMessage[]> {
    const chatId = this.getChatId(userId1, userId2);
    console.log('[getMessages] Getting messages for chat ID:', chatId);

    if (!this.messageSubjects[chatId]) {
      console.log('[getMessages] Creating new message subject for chat:', chatId);
      this.messageSubjects[chatId] = new BehaviorSubject<ChatMessage[]>([]);

      // Load existing messages from the server
      this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${chatId}`).subscribe({
        next: (messages) => {
          console.log('[getMessages] Loaded existing messages:', messages);
          if (messages && messages.length > 0) {
            this.messageSubjects[chatId].next(messages);
          }
        },
        error: (error) => {
          console.error('[getMessages] Error loading messages:', error);
        }
      });
    }

    return this.messageSubjects[chatId].asObservable();
  }

  getActiveChats(): Observable<OnlineUser[]> {
    return this.activeChats.asObservable();
  }

  private getChatId(userId1: string, userId2: string): string {
    // Always sort the IDs to ensure consistent chat ID regardless of who is sender/recipient
    const participants = [userId1, userId2].sort();
    return participants.join('-');
  }

  private closeAllChats() {
    console.log('[closeAllChats] Closing all chat dialogs');
    // Close all tracked dialogs
    this.openChatDialogs.forEach((dialogRef, userId) => {
      dialogRef.close();
    });
    this.openChatDialogs.clear();
    // Clear active chats
    this.activeChats.next([]);
    this.activeChatId.next(null);
    // Clear minimized chats
    this.minimizedChatIds.next([]);
  }

  refreshMessages(userId1: string, userId2: string): Observable<ChatMessage[]> {
    const chatId = this.getChatId(userId1, userId2);
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${chatId}`);
  }

  isChatActive(userId: string): boolean {
    return this.openChatDialogs.has(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.value.some(user => user.id === userId);
  }

  onNewMessage(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  getActiveChatId(): Observable<string | null> {
    return this.activeChatId.asObservable();
  }

  setActiveChatId(userId: string) {
    this.activeChatId.next(userId);
  }

  // New method to send chat request only when a real message is sent
  sendChatRequestIfNeeded(recipientId: string) {
    // Always send chat request when sending the first message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'chat_request',
        recipientId
      }));
    }
  }

  // Track open chat dialogs
  openChatDialog(user: OnlineUser) {
    console.log('[openChatDialog] Opening dialog for user:', user.id, user.name);

    // Close existing dialog if open
    if (this.openChatDialogs.has(user.id)) {
      console.log('[openChatDialog] Closing existing dialog for user:', user.id);
      const existingDialog = this.openChatDialogs.get(user.id);
      if (existingDialog) {
        existingDialog.close();
      }
      this.openChatDialogs.delete(user.id);
    }

    // Create fresh copy of user data
    const userData = { ...user };

    // Open new dialog
    const dialogRef = this.dialog.open(ChatDialogComponent, {
      width: '400px',
      height: '600px',
      position: { bottom: '24px', right: '24px' },
      hasBackdrop: false,
      panelClass: 'chat-dialog-container',
      data: { user: userData }
    });

    // Track the dialog
    this.openChatDialogs.set(user.id, dialogRef);

    // Handle dialog close
    dialogRef.afterClosed().subscribe(() => {
      console.log('[openChatDialog] Dialog closed for user:', user.id);
      this.openChatDialogs.delete(user.id);
      this.currentOpenChatId = null;
      this.closeChatDialog(user.id);
    });

    this.removePendingRequest(user.id);

    // Ensure user is in activeChats
    const currentChats = this.activeChats.value;
    if (!currentChats.find(chat => chat.id === user.id)) {
      this.activeChats.next([...currentChats, user]);
    }
    // Track the currently open chat dialog
    this.currentOpenChatId = user.id;

    return dialogRef;
  }

  closeChatDialog(userId: string) {
    console.log('[closeChatDialog] Closing dialog for user:', userId);

    // Close the dialog if it exists
    const dialogRef = this.openChatDialogs.get(userId);
    if (dialogRef) {
      dialogRef.close();
      this.openChatDialogs.delete(userId);
    }

    // Remove from active chats
    const currentChats = this.activeChats.value;
    this.activeChats.next(currentChats.filter(chat => chat.id !== userId));

    // Clear active chat ID if this was the active chat
    if (this.activeChatId.value === userId) {
      this.activeChatId.next(null);
    }
  }

  // Minimized chat tracking
  public getMinimizedChatIds(): Observable<string[]> {
    return this.minimizedChatIds.asObservable();
  }
  public minimizeChat(userId: string): void {
    const ids = this.minimizedChatIds.value;
    if (!ids.includes(userId)) {
      this.minimizedChatIds.next([...ids, userId]);
    }
  }
  public unminimizeChat(userId: string): void {
    const ids = this.minimizedChatIds.value.filter(id => id !== userId);
    this.minimizedChatIds.next(ids);
  }

  // Robust pending chat request/unread tracking
  public getPendingChatRequests(): Observable<Set<string>> {
    return this.pendingChatRequests.asObservable();
  }
  private addPendingRequest(userId: string) {
    const set = new Set(this.pendingChatRequests.value);
    set.add(userId);
    this.pendingChatRequests.next(set);
  }
  private removePendingRequest(userId: string) {
    const set = new Set(this.pendingChatRequests.value);
    set.delete(userId);
    this.pendingChatRequests.next(set);
  }

  // Returns true if the chat dialog is open and visible (not minimized)
  public isChatDialogOpen(userId: string): boolean {
    return this.currentOpenChatId === userId;
  }

  public onNewPost(): Observable<any> {
    return this.newPostSubject.asObservable();
  }

  private handleNewPostNotification(post: any) {
    this.newPostSubject.next(post);
  }

  // Fetch unread chats for a user
  public getUnreadChats(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/unread/${userId}`);
  }

  // Mark all messages from sender to recipient as read
  public markChatAsRead(senderId: string, recipientId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/markAsRead`, { senderId, recipientId }).pipe(
      tap(() => {
        this.getUnreadChats(recipientId).subscribe(unreadChats => {
          const newSet = new Set<string>();
          if (unreadChats && unreadChats.length > 0) {
            unreadChats.forEach(chat => newSet.add(chat.senderId));
          }
          this.pendingChatRequests.next(newSet);
        });
      })
    );
  }
}
