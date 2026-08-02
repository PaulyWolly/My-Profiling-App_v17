import { Injectable } from '@angular/core';
import { AuthService, User } from '@auth0/auth0-angular';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AccountService } from './account.service';
import { Account } from '@app/_models';
import { environment } from '@environments/environment';

@Injectable({
    providedIn: 'root'
})
export class Auth0Service {
    private auth0UserSubject = new BehaviorSubject<User | null>(null);
    public auth0User$ = this.auth0UserSubject.asObservable();

    constructor(
        public auth: AuthService,
        private accountService: AccountService,
        private router: Router
    ) {
        // Listen for Auth0 authentication state changes
        this.auth.isAuthenticated$.subscribe(isAuthenticated => {
            console.log('[Auth0Service] Auth0 authentication state changed:', isAuthenticated);
            if (isAuthenticated) {
                this.auth.user$.subscribe(user => {
                    console.log('[Auth0Service] Auth0 user data:', user);
                    if (user) {
                        this.auth0UserSubject.next(user);
                        this.handleAuth0Login(user);
                    }
                });
            } else {
                this.auth0UserSubject.next(null);
            }
        });
    }

    private handleAuth0Login(user: User) {
        console.log('[Auth0Service] Auth0 user logged in:', user);

        // App logout clears the JWT first; Auth0 may still be signed in for a
        // moment. Do not mint a new session or flash "Logging you in..." then.
        if (sessionStorage.getItem('auth_logging_out') === '1') {
            console.log('[Auth0Service] Ignoring Auth0 session during logout');
            return;
        }

        // Create or update account in your system — navigate only AFTER the JWT exists.
        // Navigating to /profile before that made AuthGuard bounce back to login
        // and flash the form for a second.
        this.createOrUpdateAccountFromAuth0(user).subscribe({
            next: (account) => {
                console.log('[Auth0Service] Account created/updated:', account);
                console.log('[Auth0Service] Authentication complete - JWT token stored by AccountService');

                const url = this.router.url.split('?')[0];
                const alreadyInApp =
                    url.startsWith('/profile') ||
                    url.startsWith('/admin') ||
                    url.startsWith('/super-admin') ||
                    url.startsWith('/ai-tools');

                if (!alreadyInApp) {
                    console.log('[Auth0Service] Navigating to /profile for role:', account.role);
                    this.router.navigate(['/profile']);
                }
            },
            error: (error) => {
                console.error('[Auth0Service] Error creating/updating account:', error);
            }
        });
    }

    private createOrUpdateAccountFromAuth0(user: User): Observable<Account> {
        // Get the Auth0 access token and send it to the backend
        return this.auth.getAccessTokenSilently().pipe(
            switchMap(token => {
                // Send the Auth0 token to the backend for authentication
                return this.accountService.loginWithAuth0(token);
            })
        );
    }

    // Method to check if user is authenticated via Auth0
    isAuthenticatedWithAuth0(): Observable<boolean> {
        return this.auth.isAuthenticated$;
    }

    // Method to get current Auth0 user
    getCurrentUser(): Observable<User | null> {
        return this.auth.user$.pipe(
            map(user => user || null)
        );
    }

    // Method to logout from Auth0 (only when Auth0 is configured; otherwise skip to avoid broken redirect to https://v2/logout)
    logoutFromAuth0(): void {
        const domain = environment.auth0?.domain?.trim();
        if (!domain) {
            console.log('[Auth0Service] Auth0 domain not configured; skipping Auth0 logout redirect');
            return;
        }
        console.log('[Auth0Service] Logging out from Auth0');
        this.auth.logout({
            logoutParams: {
                returnTo: window.location.origin + '/account/login'
            }
        });
    }
}
