import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { environment } from '@environments/environment';
import { PROFILE_TEMPLATES, ProfileTemplate, ProfileTemplateType } from '../_models/profile-template';
import { AccountService } from './account.service';

const baseUrl = `${environment.apiUrl}/accounts`;

@Injectable({ providedIn: 'root' })
export class ProfileTemplateService {
    private currentTemplateSubject: BehaviorSubject<ProfileTemplateType>;
    public currentTemplate: Observable<ProfileTemplateType>;

    constructor(
        private http: HttpClient,
        private accountService: AccountService
    ) {
        // Get saved template from storage or use standard as default
        let savedTemplate = localStorage.getItem('profileTemplate');
        
        // Make sure the saved template is a valid enum value
        if (!savedTemplate || !Object.values(ProfileTemplateType).includes(savedTemplate as ProfileTemplateType)) {
            savedTemplate = ProfileTemplateType.STANDARD;
            localStorage.setItem('profileTemplate', savedTemplate);
        }
        
        console.log('[ProfileTemplateService] Initializing with template:', savedTemplate);
        this.currentTemplateSubject = new BehaviorSubject<ProfileTemplateType>(savedTemplate as ProfileTemplateType);
        this.currentTemplate = this.currentTemplateSubject.asObservable();
    }

    public get currentTemplateValue(): ProfileTemplateType {
        return this.currentTemplateSubject.value;
    }

    public getTemplates(): ProfileTemplate[] {
        return PROFILE_TEMPLATES;
    }

    public getTemplateById(id: ProfileTemplateType): ProfileTemplate | undefined {
        return PROFILE_TEMPLATES.find(template => template.id === id);
    }

    public setTemplate(templateType: ProfileTemplateType, skipDatabaseUpdate: boolean = false): void {
        console.log('[ProfileTemplateService] Setting template to:', templateType);
        
        // Ensure we're working with a valid enum value
        if (!Object.values(ProfileTemplateType).includes(templateType)) {
            console.error('[ProfileTemplateService] Invalid template type:', templateType);
            return;
        }
        
        // Immediately update locally
        localStorage.setItem('profileTemplate', templateType);
        this.currentTemplateSubject.next(templateType);
        
        if (skipDatabaseUpdate || !this.accountService.accountValue || !this.accountService.accountValue.id) {
            console.log('[ProfileTemplateService] Not updating database (skipUpdate or no user account/ID)');
            return;
        }

        // If logged in, update in database in background (don't wait for response)
        console.log('[ProfileTemplateService] Updating template in database');
        
        // Update directly with the account service
        const userId = this.accountService.accountValue.id;
        this.accountService.update(userId, { profileTemplateType: templateType })
            .pipe(
                catchError(error => {
                    console.error('[ProfileTemplateService] Error updating template in database:', error);
                    return of(null);
                })
            )
            .subscribe(response => {
                console.log('[ProfileTemplateService] Template updated in database response:', response);
            });
    }

    // Initialize template from user account
    public initFromAccount(templateType: ProfileTemplateType): void {
        console.log('[ProfileTemplateService] Initializing from account with template:', templateType);
        
        // Ensure we're working with a valid enum value
        if (!Object.values(ProfileTemplateType).includes(templateType)) {
            console.error('[ProfileTemplateService] Invalid template type from account:', templateType);
            templateType = ProfileTemplateType.STANDARD;
        }
        
        localStorage.setItem('profileTemplate', templateType);
        this.currentTemplateSubject.next(templateType);
    }
} 