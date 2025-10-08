import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private userSubject: BehaviorSubject<User | null>;
  public user: Observable<User | null>;

  constructor(private http: HttpClient) {
    this.userSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
    this.user = this.userSubject.asObservable();
  }

  public get userValue(): User | null {
    return this.userSubject.value;
  }

  login(username: string, password: string) {
    return this.http.post<User>(`${environment.apiUrl}/api/account/login`, { username, password }, { withCredentials: true })
      .pipe(map(user => {
        // Store user details and token in local storage
        localStorage.setItem('user', JSON.stringify(user));
        this.userSubject.next(user);
        return user;
      }));
  }

  logout() {
    // Remove user from local storage and set current user to null
    localStorage.removeItem('user');
    this.userSubject.next(null);
    
    // Call logout endpoint to clear session
    return this.http.post(`${environment.apiUrl}/api/account/logout`, {}, { withCredentials: true });
  }

  register(user: User) {
    return this.http.post(`${environment.apiUrl}/api/account/register`, user, { withCredentials: true });
  }

  getAll() {
    return this.http.get<User[]>(`${environment.apiUrl}/api/account`, { withCredentials: true });
  }

  getById(id: string) {
    return this.http.get<User>(`${environment.apiUrl}/api/account/${id}`, { withCredentials: true });
  }

  update(id: string, params: any) {
    return this.http.put(`${environment.apiUrl}/api/account/${id}`, params, { withCredentials: true })
      .pipe(map(x => {
        // Update stored user if the logged in user updated their own record
        if (id === this.userValue?.id) {
          const user = { ...this.userValue, ...params };
          localStorage.setItem('user', JSON.stringify(user));
          this.userSubject.next(user);
        }
        return x;
      }));
  }

  delete(id: string) {
    return this.http.delete(`${environment.apiUrl}/api/account/${id}`, { withCredentials: true })
      .pipe(map(x => {
        // Auto logout if the logged in user deleted their own record
        if (id === this.userValue?.id) {
          this.logout();
        }
        return x;
      }));
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }
} 