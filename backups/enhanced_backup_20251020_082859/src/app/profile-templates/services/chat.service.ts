import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id?: string;
  content: string;
  senderId: string;
  recipientId: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl + '/api/chat';
  private activeChats = new BehaviorSubject<any[]>([]);
  private messageSubjects: { [key: string]: BehaviorSubject<ChatMessage[]> } = {};

  constructor(private http: HttpClient) {
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    // Initialize WebSocket connection for real-time updates
    // const ws = new WebSocket(environment.wsUrl);
    // ws.onmessage = (event) => this.handleWebSocketMessage(event);
  }

  private handleWebSocketMessage(event: any) {
    const message = JSON.parse(event.data);
    const chatId = this.getChatId(message.senderId, message.recipientId);
    
    if (this.messageSubjects[chatId]) {
      const currentMessages = this.messageSubjects[chatId].value;
      this.messageSubjects[chatId].next([...currentMessages, message]);
    }
  }

  startChat(userId: string): void {
    const currentChats = this.activeChats.value;
    if (!currentChats.find(chat => chat.userId === userId)) {
      // Get user info and add to active chats
      this.http.get(`${this.apiUrl}/users/${userId}`).subscribe(user => {
        this.activeChats.next([...currentChats, user]);
      });
    }
  }

  closeChat(userId: string): void {
    const currentChats = this.activeChats.value;
    this.activeChats.next(currentChats.filter(chat => chat.userId !== userId));
  }

  sendMessage(message: ChatMessage): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/messages`, message);
  }

  getMessages(userId1: string, userId2: string): Observable<ChatMessage[]> {
    const chatId = this.getChatId(userId1, userId2);
    
    if (!this.messageSubjects[chatId]) {
      this.messageSubjects[chatId] = new BehaviorSubject<ChatMessage[]>([]);
      
      // Load initial messages
      this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${chatId}`).subscribe(
        messages => this.messageSubjects[chatId].next(messages)
      );
    }
    
    return this.messageSubjects[chatId].asObservable();
  }

  getActiveChats(): Observable<any[]> {
    return this.activeChats.asObservable();
  }

  private getChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('-');
  }
} 