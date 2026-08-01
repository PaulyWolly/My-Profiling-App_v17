import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AccountService } from '@app/_services';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    constructor(private accountService: AccountService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError((err: HttpErrorResponse) => {
            // Requests made with responseType 'blob' (audio, downloads) get their
            // error body handed back as a Blob, so the server's JSON message is
            // unreadable and every branch below would fall back to generic text.
            if (err.error instanceof Blob) {
                return from(err.error.text()).pipe(
                    switchMap((text) => this.fail(request, err, this.parseErrorBody(text)))
                );
            }
            return this.fail(request, err, err.error);
        }));
    }

    private parseErrorBody(text: string): any {
        try {
            return JSON.parse(text);
        } catch {
            const trimmed = (text || '').trim();
            return trimmed ? { message: trimmed } : null;
        }
    }

    private fail(request: HttpRequest<any>, err: HttpErrorResponse, body: any): Observable<never> {
        console.log('[ErrorInterceptor] Error:', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            error: body
        });

        let errorMessage = 'An error occurred';

        // Handle connection errors
        if (err.status === 0) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        }
        // Handle 409 Conflict
        else if (err.status === 409) {
            errorMessage = body?.message || 'A conflict occurred with the current operation.';
        }
        // Handle 401/403 auth errors
        else if ([401, 403].includes(err.status)) {
            const isAuthEndpoint = request.url?.includes('/accounts/authenticate')
                || request.url?.includes('/accounts/register')
                || request.url?.includes('/accounts/auth0/authenticate');
            if (this.accountService.accountValue && !request.url?.includes('revoke-token') && !isAuthEndpoint) {
                this.accountService.logout();
            }
            errorMessage = isAuthEndpoint
                ? (body?.message || 'Email or password is incorrect.')
                : 'Your session has expired. Please log in again.';
        }
        // Handle 400 Bad Request
        else if (err.status === 400) {
            errorMessage = body?.message || 'Invalid request. Please check your input and try again.';
        }
        // Handle 404 Not Found
        else if (err.status === 404) {
            errorMessage = 'The requested resource was not found.';
        }
        // Handle 413 Payload Too Large
        else if (err.status === 413) {
            errorMessage = body?.message || 'File too large for upload.';
        }
        // Handle 500 Server Error — show API message when available (e.g. OpenAI errors)
        else if (err.status >= 500) {
            errorMessage = body?.message || 'A server error occurred. Please try again later.';
        }
        // Handle other errors
        else {
            errorMessage = body?.message || err.statusText || 'An unexpected error occurred.';
        }

        // Create a user-friendly error object
        const error = {
            status: err.status,
            message: errorMessage,
            originalError: err
        };

        console.error(`[ErrorInterceptor] Passing error downstream:`, error);
        return throwError(() => error);
    }
}