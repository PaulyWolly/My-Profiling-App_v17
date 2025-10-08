import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AccountService } from '@app/_services';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    constructor(private accountService: AccountService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError((err: HttpErrorResponse) => {
            console.log('[ErrorInterceptor] Error:', {
                status: err.status,
                statusText: err.statusText,
                url: err.url,
                error: err.error
            });

            let errorMessage = 'An error occurred';

            // Handle connection errors
            if (err.status === 0) {
                errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            }
            // Handle 409 Conflict
            else if (err.status === 409) {
                errorMessage = err.error?.message || 'A conflict occurred with the current operation.';
            }
            // Handle 401/403 auth errors
            else if ([401, 403].includes(err.status)) {
                if (this.accountService.accountValue && !request.url?.includes('revoke-token')) {
                    this.accountService.logout();
                }
                errorMessage = 'Your session has expired. Please log in again.';
            }
            // Handle 400 Bad Request
            else if (err.status === 400) {
                errorMessage = err.error?.message || 'Invalid request. Please check your input and try again.';
            }
            // Handle 404 Not Found
            else if (err.status === 404) {
                errorMessage = 'The requested resource was not found.';
            }
            // Handle 500 Server Error
            else if (err.status >= 500) {
                errorMessage = 'A server error occurred. Please try again later.';
            }
            // Handle other errors
            else {
                errorMessage = err.error?.message || err.statusText || 'An unexpected error occurred.';
            }

            // Create a user-friendly error object
            const error = {
                status: err.status,
                message: errorMessage,
                originalError: err
            };

            console.error(`[ErrorInterceptor] Passing error downstream:`, error);
            return throwError(() => error);
        }));
    }
}