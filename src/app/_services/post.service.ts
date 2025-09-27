import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PostService {
  private apiUrl = environment.apiUrl + '/api/posts';

  constructor(private http: HttpClient) {}

  getPostsForUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?userId=${userId}`);
  }

  createPost(post: { sender: string; recipient: string; content: string; respondingTo?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, post);
  }

  addReply(postId: string, reply: { sender: string; content: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${postId}/reply`, reply);
  }

  deletePost(postId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${postId}`, { withCredentials: true });
  }

  likePost(postId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${postId}/like`, {});
  }

  sharePost(postId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${postId}/share`, {});
  }
} 