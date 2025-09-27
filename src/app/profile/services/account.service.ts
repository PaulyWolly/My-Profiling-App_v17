import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Account {
    id: string;
    email: string;
    profileImage?: string;
    role?: string;
    // Add other account properties as needed
}

@Injectable({
    providedIn: 'root'
})
export class AccountService {
    private accountSubject = new BehaviorSubject<Account | null>(null);
    public account$ = this.accountSubject.asObservable();

    constructor(private http: HttpClient) {
        console.log('[AccountService] Initializing with environment:', {
            apiUrl: environment.apiUrl,
            production: environment.production
        });
    }

    public get userValue(): Account | null {
        console.log('[AccountService] Getting userValue:', this.accountSubject.value);
        return this.accountSubject.value;
    }

    public get accountValue(): Account | null {
        const value = this.accountSubject.value;
        console.log('[AccountService] Getting current account value:', {
            hasValue: !!value,
            id: value?.id,
            email: value?.email,
            hasProfileImage: !!value?.profileImage
        });
        return value;
    }

    private getFullImageUrl(imagePath: string): string {
        console.log('[AccountService] Processing image path:', { original: imagePath });
        
        if (!imagePath) {
            console.log('[AccountService] Empty image path provided');
            return '';
        }

        let fullUrl: string;
        
        // If it's already a full URL, return as is
        if (imagePath.startsWith('http')) {
            console.log('[AccountService] Image path is already a full URL');
            fullUrl = imagePath;
        }
        // If it's a path starting with /uploads, append to API URL
        else if (imagePath.startsWith('/uploads/')) {
            fullUrl = `${environment.apiUrl}${imagePath}`;
            console.log('[AccountService] Using uploads path:', fullUrl);
        }
        // Legacy format - ensure it's in the profiles directory
        else {
            fullUrl = `${environment.apiUrl}/uploads/profiles/${imagePath}`;
            console.log('[AccountService] Converting to profiles path:', fullUrl);
        }

        console.log('[AccountService] Final image URL:', {
            original: imagePath,
            processed: fullUrl
        });
        
        return fullUrl;
    }

    uploadImage(userId: string, formData: FormData): Observable<any> {
        console.log('[AccountService] Starting image upload:', {
            userId,
            hasFormData: !!formData
        });

        return this.http.post<{profileImage: string}>(`${environment.apiUrl}/accounts/upload-profile-image`, formData)
            .pipe(
                map(response => {
                    console.log('[AccountService] Upload response:', response);
                    const fullImageUrl = this.getFullImageUrl(response.profileImage);
                    return {
                        ...response,
                        profileImage: fullImageUrl
                    };
                }),
                tap(response => {
                    console.log('[AccountService] Processed upload response:', response);
                    // Update the account value with the new image
                    const account = this.accountSubject.value;
                    if (account && response?.profileImage) {
                        account.profileImage = response.profileImage;
                        this.accountSubject.next(account);
                        console.log('[AccountService] Updated account with new image');
                    }
                }),
                catchError(error => {
                    console.error('[AccountService] Upload error:', error);
                    return throwError(() => error);
                })
            );
    }

    migrateImages(): Observable<any> {
        console.log('[AccountService] Starting image migration');
        return this.http.post(`${environment.apiUrl}/accounts/migrate-images`, {})
            .pipe(
                tap(response => {
                    console.log('[AccountService] Migration response:', response);
                }),
                catchError(error => {
                    console.error('[AccountService] Migration error:', error);
                    return throwError(() => error);
                })
            );
    }

    checkImageExists(imagePath: string): Observable<boolean> {
        const fullUrl = this.getFullImageUrl(imagePath);
        console.log('[AccountService] Checking image existence:', {
            original: imagePath,
            fullUrl
        });

        return this.http.head(fullUrl, { observe: 'response' })
            .pipe(
                map(response => {
                    const exists = response.status === 200;
                    console.log('[AccountService] Image check result:', {
                        exists,
                        status: response.status,
                        headers: response.headers
                    });
                    return exists;
                }),
                catchError(error => {
                    console.log('[AccountService] Image does not exist:', {
                        url: fullUrl,
                        error: error.message,
                        status: error.status
                    });
                    return of(false);
                })
            );
    }
} 