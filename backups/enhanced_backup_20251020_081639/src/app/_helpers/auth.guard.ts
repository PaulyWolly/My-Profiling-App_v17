import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AccountService } from '@app/_services';

@Injectable({ providedIn: 'root' })
export class AuthGuard  {
    constructor(
        private router: Router,
        private accountService: AccountService
    ) { }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        const account = this.accountService.accountValue;
        console.log('[AuthGuard] Checking activation for', state.url);
        console.log('[AuthGuard] Account value:', account ? 'Logged in' : 'Not logged in');

        // Check for stored JWT token in sessionStorage only (consistent with AccountService)
        const jwtToken = sessionStorage.getItem('jwt_token');

        if (account && jwtToken) {
            console.log('[AuthGuard] User is authenticated with valid account and token');

            // Check if route is restricted by role
            if (route.data.roles && route.data.roles.length) {
                const accountRole = account.role;
                console.log('[AuthGuard] Checking role authorization:', {
                    userRole: accountRole,
                    requiredRoles: route.data.roles
                });

                // Check if user has required role
                if (!accountRole || !route.data.roles.includes(accountRole)) {
                    console.log(`[AuthGuard] Role '${accountRole}' not authorized for route. Required roles:`, route.data.roles);
                    // Redirect to home page if not in required role
                    this.router.navigate(['/']);
                    return false;
                }
                console.log(`[AuthGuard] Role '${accountRole}' is authorized for route`);
            }
            return true;
        }

        // Not logged in - redirect to login page with return url
        console.log('[AuthGuard] User not authenticated, redirecting to login');
        this.router.navigate(['/account/login'], { queryParams: { returnUrl: state.url } });
        return false;
    }
}
