import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Account, FollowerImage } from '@app/_models';

@Injectable({ providedIn: 'root' })
export class UploadService {
    constructor(private http: HttpClient) { }

    uploadProfileImage(file: File, existingFormData?: FormData) {
        const formData = existingFormData || new FormData();
        if (!existingFormData) {
            formData.append('profileImage', file);
        }

        return this.http.post<Account>(`${environment.apiUrl}/accounts/upload-profile-image`, formData);
    }
    
    uploadFollowerImage(file: File, followerName: string, followerTitle?: string) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('followerName', followerName);
        
        if (followerTitle) {
            formData.append('followerTitle', followerTitle);
        }

        return this.http.post<FollowerImage>(
            `${environment.apiUrl}/upload/follower-image`,
            formData,
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );
    }

    uploadTempProfileImage(file: File, email?: string, firstname?: string, lastname?: string) {
        const formData = new FormData();
        formData.append('file', file);
        if (email) formData.append('email', email);
        if (firstname) formData.append('firstname', firstname);
        if (lastname) formData.append('lastname', lastname);
        
        // Log the FormData contents for debugging
        console.log('[UploadService] Uploading temp profile image with:', {
            hasFile: !!file,
            email,
            firstname,
            lastname,
            formDataKeys: ['file', 'email', 'firstname', 'lastname'].filter(key => formData.has(key))
        });

        return this.http.post<any>(`${environment.apiUrl}/upload/temp-profile-image`, formData);
    }
} 