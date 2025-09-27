import { catchError, of } from 'rxjs';

import { AccountService } from '@app/_services';

const JWT_TOKEN_KEY = 'jwt_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function appInitializer(accountService: AccountService) {
    return () => {
        // Get the current URL to preserve it after refresh
        const currentUrl = window.location.pathname;
        console.log('[AppInitializer] Current URL:', currentUrl);

        // Initialize the account service first
        console.log('[AppInitializer] Initializing account service');
        accountService.initialize();

        // Check if we have a stored account after initialization
        const currentAccount = accountService.accountValue;
        const jwtToken = sessionStorage.getItem(JWT_TOKEN_KEY);
        const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

        console.log('[AppInitializer] Starting with account:',
            currentAccount ? 'Logged in' : 'Not logged in',
            'JWT:', !!jwtToken,
            'RefreshToken:', !!refreshToken);

        // If we have tokens but no account, try to refresh
        if ((jwtToken || refreshToken) && !currentAccount) {
            console.log('[AppInitializer] Have tokens but no account, attempting refresh');
            return accountService.refreshToken()
                .pipe(
                    catchError((error) => {
                        console.error('[AppInitializer] Token refresh failed:', error);

                        // If we have a valid JWT token, create a minimal account to preserve the session
                        if (jwtToken) {
                            try {
                                const jwtBase64 = jwtToken.split('.')[1];
                                const jwtData = JSON.parse(atob(jwtBase64));

                                // Create a minimal account to prevent redirect
                                const minimalAccount = {
                                    id: jwtData.id,
                                    jwtToken: jwtToken,
                                    refreshToken: refreshToken,
                                    role: jwtData.role || 'User',
                                    isVerified: true
                                };

                                // Update account subject to keep user logged in
                                accountService['accountSubject'].next(minimalAccount as any);
                                accountService['startRefreshTokenTimer']();
                                console.log('[AppInitializer] Created minimal account from JWT');
                            } catch (e) {
                                console.error('[AppInitializer] Error creating minimal account:', e);
                            }
                        }

                        // Allow app to continue even if refresh fails
                        return of(null);
                    })
                );
        }

        // Account is already restored or no tokens available
        console.log('[AppInitializer] Authentication state restored or no tokens available');
        return of(null);
    };
}
