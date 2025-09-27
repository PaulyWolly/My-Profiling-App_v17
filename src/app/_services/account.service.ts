import { Injectable, Injector, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, finalize, catchError, switchMap, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { JwtHelperService, JWT_OPTIONS } from '@auth0/angular-jwt';

import { environment } from '@environments/environment';
import { Account, AccountUpdate, Role } from '@app/_models';

const baseUrl = `${environment.apiUrl}/accounts`;
const TAB_ID_KEY = 'current_tab_id';

export interface SystemSettings {
    activeSessionCount: number;
    lastSessionCleanup: Date | null;
    nextScheduledCleanup: Date | null;
    cleanupSchedule: string;
}

export interface CleanupResult {
    lastCleanup: Date;
    nextScheduled: Date;
    message: string;
}

export interface CleanupHistoryRecord {
    id: string;
    timestamp: Date;
    executedBy: string;
    executedByEmail: string;
    sessionsCleaned: number;
    tokensRevoked: number;
    executionTime: number;
    result: string;
    isAutomatic: boolean;
    ipAddress: string;
}

export interface CleanupHistoryResponse {
    history: CleanupHistoryRecord[];
    pagination: {
        total: number;
        limit: number;
        skip: number;
        hasMore: boolean;
    };
}

// Helper to join base URL and path without double slashes
export function joinUrl(base: string, path: string): string {
    if (base.endsWith('/') && path.startsWith('/')) {
        return base + path.substring(1);
    }
    if (!base.endsWith('/') && !path.startsWith('/')) {
        return base + '/' + path;
    }
    return base + path;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
    private accountSubject: BehaviorSubject<Account | null>;
    public account: Observable<Account | null>;
    private readonly JWT_TOKEN_KEY = 'jwt_token';
    private readonly REFRESH_TOKEN_KEY = 'refresh_token';
    private readonly REMEMBER_ME_KEY = 'remember_me';
    private readonly TAB_ID_KEY = 'current_tab_id';
    private currentTabId: string;
    private initialized = false;
    private refreshTokenTimeout: NodeJS.Timeout | undefined;

    constructor(
        private router: Router,
        private http: HttpClient,
        @Inject(JwtHelperService) private jwtHelper: JwtHelperService
    ) {
        // Generate a unique ID for this tab
        this.currentTabId = 'tab_' + Math.random().toString(36).substr(2, 9);
        this.accountSubject = new BehaviorSubject<Account | null>(null);
        this.account = this.accountSubject.asObservable();
    }

    // Lazy getter for HttpClient to avoid circular dependency
    private getHttp(): HttpClient {
        return this.http;
    }

    // Initialize at app startup - call this from app component, not constructor
    public initialize() {
        if (this.initialized) return;

        console.log('[AccountService] Initializing service for tab:', this.currentTabId);

        // Check if this tab's ID matches the stored ID
        const storedTabId = localStorage.getItem(this.TAB_ID_KEY);
        const jwtToken = this.getStoredToken();
        const refreshToken = this.getStoredRefreshToken();

        console.log('[AccountService] Initialization state:', {
            storedTabId,
            currentTabId: this.currentTabId,
            hasJwtToken: !!jwtToken,
            hasRefreshToken: !!refreshToken
        });

        // Always try to restore the session if we have tokens
        if (jwtToken || refreshToken) {
            this.initializeFromStorage();
        } else {
            console.log('[AccountService] No tokens found during initialization');
            this.accountSubject.next(null);
        }

        // Store this tab's ID
        localStorage.setItem(this.TAB_ID_KEY, this.currentTabId);
        this.initialized = true;
    }

    private getStoredToken(): string | null {
        // Only check sessionStorage for JWT token
        return sessionStorage.getItem(this.JWT_TOKEN_KEY);
    }

    private getStoredRefreshToken(): string | null {
        // Only check sessionStorage for refresh token
        return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    get accountValue() {
        console.log('[AccountService] Getting account value:', this.accountSubject.value);
        return this.accountSubject.value;
    }

    public get isAdmin(): boolean {
        return this.accountValue?.role === Role.Admin;
    }

    // Helper method to format image URLs
    private formatImageUrl(imagePath: string | undefined): string | undefined {
        if (!imagePath) return undefined;

        // If it's already a full URL, return it as is
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        // Remove any leading slash from the image path
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;

        // Remove any trailing slashes from the base URL
        const baseUrl = environment.apiUrl.replace(/\/+$/, '');

        // Construct the full URL
        const fullUrl = `${baseUrl}/${cleanPath}`;

        return fullUrl;
    }

    // Authentication endpoints
    login(email: string, password: string, rememberMe: boolean = false) {
        console.log('[AccountService] Attempting login for:', email);
        return this.getHttp().post<Account>(`${baseUrl}/authenticate`, { email, password, rememberMe }, { withCredentials: true })
            .pipe(
                map(account => {
                    console.log('[AccountService] Login successful:', account);

                    // Format profile image URL if needed
                    if (account.profileImage) {
                        account.profileImage = this.formatImageUrl(account.profileImage);
                    }

                    // Store auth data based on rememberMe preference
                    this.storeAuthData(account, rememberMe, email);

                    this.accountSubject.next(account);
                    this.startRefreshTokenTimer();

                    return account;
                })
            );
    }

    logout() {
        console.log('[AccountService] Logging out');
        this.clearAuthData(); // Ensure all tokens and session data are removed
        this.http.post<any>(`${environment.apiUrl}/accounts/revoke-token`, {}, { withCredentials: true }).subscribe();
        this.stopRefreshTokenTimer();
        this.accountSubject.next(null);
        this.router.navigate(['/account/login']);
    }

    // Auth0 login method
    loginWithAuth0(auth0Token: string) {
        console.log('[AccountService] Attempting Auth0 login');
        return this.http.post<Account>(`${environment.apiUrl}/accounts/auth0/authenticate`, {}, {
            headers: {
                Authorization: `Bearer ${auth0Token}`
            }
        }).pipe(
            map(account => {
                // Format profile image URL if needed
                if (account.profileImage) {
                    account.profileImage = this.formatImageUrl(account.profileImage);
                }

                // Store auth data
                this.storeAuthData(account, false, account.email);

                this.accountSubject.next(account);
                this.startRefreshTokenTimer();

                return account;
            })
        );
    }

    // Initialize app from stored auth data
    initializeFromStorage() {
        console.log('[AccountService] Initializing from storage');
        // Check for stored tokens in sessionStorage only
        const jwtToken = sessionStorage.getItem(this.JWT_TOKEN_KEY);
        const refreshToken = sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
        const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY);
        console.log('[AccountService] Found stored data:', {
            hasJwtToken: !!jwtToken,
            hasRefreshToken: !!refreshToken,
            hasRememberMe: !!rememberMe,
            storageType: jwtToken ? 'sessionStorage' : 'none'
        });

        // If we have a JWT token, try to decode it first
        if (jwtToken) {
            try {
                const decodedToken = this.jwtHelper.decodeToken(jwtToken);
                const isExpired = this.jwtHelper.isTokenExpired(jwtToken);
                console.log('[AccountService] JWT token status:', {
                    isExpired,
                    expiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'unknown'
                });

                if (!isExpired) {
                    // Token is valid, create a minimal account to restore session
                    console.log('[AccountService] Using valid JWT token to restore session');
                    const minimalAccount = {
                        id: decodedToken.id || decodedToken.sub,
                        jwtToken: jwtToken,
                        refreshToken: refreshToken || '',
                        role: decodedToken.role || 'User',
                        email: decodedToken.email || '',
                        firstName: decodedToken.firstName || '',
                        lastName: decodedToken.lastName || '',
                        isVerified: true
                    } as Account;

                    this.setAuthState({ jwtToken });
                    this.accountSubject.next(minimalAccount);
                    this.startRefreshTokenTimer();
                    return;
                }
            } catch (error) {
                console.error('[AccountService] Error decoding JWT token:', error);
            }
        }

        // If we get here, either the JWT token is invalid or we don't have one
        // Try to refresh the token using the cookie
        console.log('[AccountService] Attempting to refresh token using cookie');
        this.refreshToken().subscribe({
            next: (account) => {
                console.log('[AccountService] Token refresh successful');
                this.setAuthState({ jwtToken: account.jwtToken, refreshToken: account.refreshToken });
            },
            error: (error) => {
                console.error('[AccountService] Token refresh failed:', error);
                // Clear invalid tokens
                this.clearAuthData();
            }
        });
    }

    // Store authentication data in sessionStorage only
    private storeAuthData(account: Account, rememberMe: boolean, email: string) {
        if (!account.jwtToken) {
            console.error('[AccountService] Cannot store auth data: missing JWT token');
            return;
        }
        console.log('[AccountService] Storing auth data for tab:', this.currentTabId);
        this.clearAuthData();
        // Only use localStorage for rememberMe email prefill
        if (rememberMe) {
            const rememberMeData = {
                remembered: true,
                userId: account.id,
                email: email,
                timestamp: new Date().getTime(),
                tabId: this.currentTabId
            };
            localStorage.setItem(this.REMEMBER_ME_KEY, JSON.stringify(rememberMeData));
        }
        sessionStorage.setItem(this.JWT_TOKEN_KEY, account.jwtToken);
        if (account.refreshToken) {
            sessionStorage.setItem(this.REFRESH_TOKEN_KEY, account.refreshToken);
        }
    }

    // Clear all authentication data from storage
    private clearAuthData() {
        console.log('[AccountService] Clearing authentication data for tab:', this.currentTabId);
        this.stopRefreshTokenTimer();
        localStorage.removeItem(this.REMEMBER_ME_KEY); // Only for rememberMe
        sessionStorage.removeItem(this.JWT_TOKEN_KEY);
        sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
        this.accountSubject.next(null);
    }

    refreshToken() {
        console.log('[AccountService] Attempting to refresh token');
        this.stopRefreshTokenTimer();
        // Do NOT read refresh token from storage; backend will use cookie
        return this.getHttp().post<Account>(`${baseUrl}/refresh-token`, {}, { withCredentials: true })
            .pipe(
                tap(account => {
                    console.log('[AccountService] Token refresh successful', account);
                    if (account.profileImage && !account.profileImage.startsWith('http')) {
                        const imagePath = account.profileImage.startsWith('/')
                            ? account.profileImage.substring(1)
                            : account.profileImage;
                        account.profileImage = `${environment.apiUrl}/${imagePath}`;
                    }
                    // Always store the new JWT and refresh token in sessionStorage
                    if (account.jwtToken) {
                        sessionStorage.setItem(this.JWT_TOKEN_KEY, account.jwtToken);
                    }
                    if (account.refreshToken) {
                        sessionStorage.setItem(this.REFRESH_TOKEN_KEY, account.refreshToken);
                    }
                    this.accountSubject.next(account);
                    console.log('[AccountService] accountSubject updated after refresh', this.accountSubject.value);
                    this.startRefreshTokenTimer();
                }),
                catchError(error => {
                    console.error('[AccountService] Token refresh failed:', error);
                    this.clearAuthData();
                    this.accountSubject.next(null);
                    this.router.navigate(['/account/login']);
                    return throwError(() => error);
                })
            );
    }

    // Account management endpoints
    register(account: AccountUpdate) {
        return this.getHttp().post(`${baseUrl}/register`, account);
    }

    verifyEmail(token: string) {
        return this.getHttp().post(`${baseUrl}/verify-email`, { token });
    }

    forgotPassword(email: string) {
        return this.getHttp().post(`${baseUrl}/forgot-password`, { email });
    }

    validateResetToken(token: string) {
        return this.getHttp().post(`${baseUrl}/validate-reset-token`, { token });
    }

    resetPassword(token: string, password: string, confirmPassword: string) {
        return this.getHttp().post(`${baseUrl}/reset-password`, { token, password, confirmPassword });
    }

    // CRUD operations
    getAll() {
        return this.getHttp().get<Account[]>(baseUrl);
    }

    getById(id: string) {
        return this.getHttp().get<Account>(`${baseUrl}/${id}`)
            .pipe(map(account => {
                console.log('[AccountService] Raw account data received:', account);

                // Format profile image URL if it exists
                if (account.profileImage) {
                    account.profileImage = this.formatImageUrl(account.profileImage);
                }

                // Format follower image URLs if they exist
                if (account.followerImages) {
                    console.log('[AccountService] Processing follower images:', account.followerImages);
                    account.followerImages = account.followerImages.map(follower => {
                        const formattedFollower = {
                            ...follower,
                            imageUrl: follower.imageUrl ? this.formatImageUrl(follower.imageUrl) : undefined
                        };
                        console.log('[AccountService] Formatted follower:', formattedFollower);
                        return formattedFollower;
                    });
                }

                console.log('[AccountService] Final formatted account data:', account);
                return account;
            }));
    }

    create(params: AccountUpdate) {
        return this.getHttp().post<Account>(`${baseUrl}`, params);
    }

    update(id: string, params: any) {
        const url = `${baseUrl}/${id}`;
        console.log('Updating account with data:', params);
        return this.getHttp().put<Account>(url, params)
            .pipe(
                map(account => {
                    // Update stored account if the current user updated their own record
                    if (account.id === this.accountValue?.id) {
                        // Format profile image URL if needed
                        if (account.profileImage && !account.profileImage.startsWith('http')) {
                            account.profileImage = this.formatImageUrl(account.profileImage);
                        }

                        // Format follower image URLs if they exist
                        if (account.followerImages) {
                            account.followerImages = account.followerImages.map(follower => ({
                                ...follower,
                                imageUrl: follower.imageUrl ? this.formatImageUrl(follower.imageUrl) : undefined
                            }));
                        }

                        // Update account in subject
                        account = { ...this.accountValue, ...account };
                        this.accountSubject.next(account);

                        // Store authentication data based on whether this was a remembered login
                        const isRemembered = !!localStorage.getItem(this.REMEMBER_ME_KEY);
                        if (isRemembered && account.jwtToken) {
                            sessionStorage.setItem(this.JWT_TOKEN_KEY, account.jwtToken);
                        } else if (account.jwtToken) {
                            sessionStorage.setItem(this.JWT_TOKEN_KEY, account.jwtToken);
                        }
                    }

                    return account;
                })
            );
    }

    delete(id: string) {
        return this.getHttp().delete(`${baseUrl}/${id}`)
            .pipe(finalize(() => {
                const currentAccount = this.accountValue;
                if (currentAccount?.id === id) {
                    this.logout();
                }
            }));
    }

    // Profile image handling
    uploadProfileImage(file: File, existingFormData?: FormData) {
        const formData = existingFormData || new FormData();
        if (!existingFormData) {
            formData.append('file', file);
        }
        return this.getHttp().post<any>(`${environment.apiUrl}/accounts/upload-profile-image`, formData);
    }

    uploadFollowerImage(file: File, followerEmail: string, followerName: string, followerTitle?: string) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('image', file); // <-- image file
        formData.append('followerEmail', followerEmail);
        formData.append('followerName', followerName);
        if (followerTitle) {
            formData.append('followerTitle', followerTitle);
        }
        return this.getHttp().post<any>(`${environment.apiUrl}/accounts/upload-follower-image`, formData);
    }

    // Timer methods
    private startRefreshTokenTimer() {
        console.log('[AccountService] Starting refresh token timer');

        // Get the current JWT token
        const token = this.getJwtToken();
        if (!token) {
            console.warn('[AccountService] No JWT token found, skipping refresh timer');
            return;
        }

        try {
            // Parse the token expiration time
            const expires = this.jwtHelper.getTokenExpirationDate(token);
            if (!expires) {
                console.warn('[AccountService] Could not determine token expiration, skipping refresh timer');
                return;
            }

            // Calculate time until expiration (subtract 60 seconds to refresh slightly early)
            const timeout = expires.getTime() - Date.now() - (60 * 1000);
            if (timeout <= 0) {
                console.warn('[AccountService] Token has already expired or will expire too soon');
                this.clearAuthData();
                this.accountSubject.next(null);
                this.router.navigate(['/account/login']);
                return;
            }

            console.log(`[AccountService] Setting refresh timer for ${Math.round(timeout / 1000)} seconds`);
            this.refreshTokenTimeout = setTimeout(() => {
                console.log('[AccountService] Refresh timer triggered');
                this.refreshToken().subscribe();
            }, timeout);

        } catch (error) {
            console.error('[AccountService] Error starting refresh timer:', error);
            this.clearAuthData();
            this.accountSubject.next(null);
            this.router.navigate(['/account/login']);
        }
    }

    private stopRefreshTokenTimer() {
        if (this.refreshTokenTimeout) {
            clearTimeout(this.refreshTokenTimeout);
            this.refreshTokenTimeout = undefined;
        }
    }

    private setAuthState({ jwtToken, refreshToken }: { jwtToken: string | undefined, refreshToken?: string }) {
        console.log('[DEBUG] setAuthState called', { jwtToken, refreshToken });
        try {
            if (!jwtToken) {
                throw new Error('JWT token is required');
            }

            const decodedToken = this.jwtHelper.decodeToken(jwtToken);
            console.log('[DEBUG] Raw Decoded Token:', decodedToken);
            console.log('[DEBUG] Checking for claims:', {
                id: decodedToken.id,
                sub: decodedToken.sub,
                role: decodedToken.role,
                email: decodedToken.email
            });

            // Extract user data from token
            const userId = decodedToken.id || decodedToken.sub;
            const userRole = decodedToken.role;
            const email = decodedToken.email;

            if (!userId || !userRole || !email) {
                throw new Error('Invalid token: missing required claims');
            }

            // Validate role
            if (![Role.User, Role.Admin, Role.SuperAdmin].includes(userRole)) {
                console.error('[DEBUG] Invalid role in token:', userRole);
                throw new Error(`Invalid token: role must be ${Role.User}, ${Role.Admin}, or ${Role.SuperAdmin}`);
            }

            // Create account object with validated data
            const account: Account = {
                id: userId,
                email: email,
                firstName: email.split('@')[0], // Temporary value until full profile is loaded
                lastName: '', // Temporary value until full profile is loaded
                role: userRole as Role,
                jwtToken,
                isVerified: true
            };

            console.log('[DEBUG] Setting account state:', {
                id: account.id,
                email: account.email,
                role: account.role,
                roleType: typeof account.role,
                isAdmin: account.role === Role.Admin
            });

            this.accountSubject.next(account);
            console.log('[DEBUG] accountSubject updated in setAuthState', this.accountSubject.value);
            this.startRefreshTokenTimer();

            // Fetch full account details in background
            if (account.id) {
                this.fetchAndUpdateFullAccountDetails(account.id);
            }
        } catch (error) {
            console.error('[DEBUG] Error setting auth state:', error);
            this.clearAuthData();
            this.accountSubject.next(null);
        }
    }

    // New private method to fetch full details asynchronously after auth state is set
    private fetchAndUpdateFullAccountDetails(accountId: string) {
        console.log(`[AccountService] Fetching full account details for ${accountId} in background`);
        this.getHttp().get<Account>(`${baseUrl}/${accountId}`).subscribe({
            next: (fullAccount) => {
                console.log('[AccountService] Successfully fetched full account details:', fullAccount);

                // Format profile image URL
                if (fullAccount.profileImage) {
                    fullAccount.profileImage = this.formatImageUrl(fullAccount.profileImage);
                }

                // Format follower image URLs if they exist
                if (fullAccount.followerImages) {
                    fullAccount.followerImages = fullAccount.followerImages.map(follower => ({
                        ...follower,
                        imageUrl: follower.imageUrl ? this.formatImageUrl(follower.imageUrl) : undefined
                    }));
                }

                // Merge full details with existing minimal account state
                const currentAccount = this.accountValue;
                if (currentAccount && currentAccount.id === accountId) {
                    const updatedAccount = {
                        ...currentAccount,
                        ...fullAccount,
                        jwtToken: currentAccount.jwtToken,
                        refreshToken: currentAccount.refreshToken
                    };
                    this.accountSubject.next(updatedAccount);
                    console.log('[AccountService] Updated accountSubject with full details');
                }
            },
            error: (error) => {
                console.error('[AccountService] Error fetching full account details in background:', error);
            }
        });
    }

    private getJwtToken(): string | null {
        const jwtToken = sessionStorage.getItem(this.JWT_TOKEN_KEY);
        return jwtToken;
    }

    // Add these methods to the AccountService class
    getSettings() {
        return this.getHttp().get<SystemSettings>(`${environment.apiUrl}/admin/settings`);
    }

    getCleanupHistory(page: number, pageSize: number) {
        const params = {
            limit: pageSize.toString(),
            skip: ((page - 1) * pageSize).toString()
        };
        return this.getHttp().get<any>(`${environment.apiUrl}/admin/cleanup-history`, { params });
    }

    cleanupSessions() {
        return this.getHttp().post<CleanupResult>(`${environment.apiUrl}/admin/cleanup-sessions`, {});
    }

    updateCleanupSchedule(schedule: string) {
        return this.getHttp().post<CleanupResult>(`${environment.apiUrl}/admin/update-cleanup-schedule`, { schedule });
    }

    // Add this method in the AccountService class
    fixProfileImage(id: string) {
        return this.getHttp().post<any>(`${baseUrl}/${id}/fix-profile-image`, {})
            .pipe(
                map(response => {
                    // Update the current account if this is the logged-in user's image
                    if (response.profileImage && !response.profileImage.startsWith('http')) {
                        response.profileImage = `${environment.apiUrl}/${response.profileImage}`;
                    }

                    const currentAccount = this.accountValue;
                    if (currentAccount && currentAccount.id === id) {
                        currentAccount.profileImage = response.profileImage;
                        this.accountSubject.next(currentAccount);
                    }
                    return response;
                })
            );
    }

    deleteCleanupRecord(id: string) {
        return this.getHttp().delete<{ message: string }>(`${environment.apiUrl}/admin/cleanup-history/${id}`);
    }

    uploadImage(id: string, formData: FormData) {
        return this.getHttp().post<any>(`${environment.apiUrl}/accounts/upload-profile-image`, formData, {
            params: { userId: id }
        })
            .pipe(
                map(response => {
                    // Format the profile image URL
                    if (response.profileImage) {
                        response.profileImage = this.formatImageUrl(response.profileImage);
                    }

                    // Update the current account if this is the logged-in user's image
                    const currentAccount = this.accountValue;
                    if (currentAccount && currentAccount.id === id) {
                        currentAccount.profileImage = response.profileImage;
                        this.accountSubject.next(currentAccount);
                    }

                    return {
                        ...response,
                        message: response.message || 'Profile image uploaded successfully'
                    };
                }),
                catchError(error => {
                    console.error('[AccountService] Upload Error:', error);
                    return throwError(() => new Error(error.error?.message || 'Failed to upload image'));
                })
            );
    }

    cleanupOrphanedTokens() {
        return this.getHttp().post<void>(`${environment.apiUrl}/accounts/cleanup-orphaned-tokens`, {});
    }

    // Fetch all active sessions for the current user
    getMySessions() {
        console.log('[AccountService] Fetching my sessions');
        return this.getHttp().get<any[]>(`${baseUrl}/my-sessions`, { withCredentials: true });
    }

    // Revoke a specific session for the current user
    revokeSession(sessionId: string) {
        console.log('[AccountService] Revoking session:', sessionId);
        return this.getHttp().post<any>(`${baseUrl}/my-sessions/${sessionId}/revoke`, {}, { withCredentials: true });
    }

    // Add a method to get the correct profile image URL
    getProfileImageUrl(profileImage: string): string {
        if (!profileImage) return 'assets/images/avatars/default-avatar.png';

        // If it's already a full URL (starts with http), return it as-is
        if (profileImage.startsWith('http')) {
            return profileImage;
        }

        // For local images, prepend the API URL
        const baseUrl = environment.apiUrl || '';
        return joinUrl(baseUrl, profileImage);
    }

    // Super-Admin password reset functionality
    resetPasswordForSuperAdmin(accountId: string, newPassword: string) {
        console.log('[AccountService] Super-Admin password reset for account:', accountId);
        return this.getHttp().post<any>(`${baseUrl}/${accountId}/reset-password`,
            { newPassword },
            { withCredentials: true }
        );
    }

    // Super-Admin get password functionality
    getPasswordForSuperAdmin(accountId: string) {
        console.log('[AccountService] Super-Admin password retrieval for account:', accountId);
        return this.getHttp().get<any>(`${baseUrl}/${accountId}/password`,
            { withCredentials: true }
        );
    }
}
