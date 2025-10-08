import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';
import { EditMode } from '@app/shared/components/edit-content/edit-content.component';

@Component({
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.css']
})
export class AccountSettingsComponent implements OnInit {
  account: any = null;
  loading = false;
  submitting = false;
  submitted = false;
  editMode = EditMode.ACCOUNT;
  isAddMode = false;

  constructor(
    private accountService: AccountService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loading = true;
    
    // Load the current user's account details
    const currentUser = this.accountService.accountValue;
    
    if (currentUser && currentUser.id) {
      this.accountService.getById(currentUser.id)
        .pipe(first())
        .subscribe({
          next: (account) => {
            this.account = account;
            this.loading = false;
          },
          error: (error) => {
            this.alertService.error(error);
            this.loading = false;
          }
        });
    } else {
      this.alertService.error('You must be logged in to edit your account');
      this.router.navigate(['/account/login']);
    }
  }

  onSave(formData: any) {
    this.submitted = true;
    this.alertService.clear();
    this.submitting = true;

    const currentUser = this.accountService.accountValue;
    
    if (currentUser && currentUser.id) {
      this.accountService.update(currentUser.id, formData)
        .pipe(first())
        .subscribe({
          next: () => {
            this.alertService.success('Account updated successfully', { keepAfterRouteChange: true });
            this.router.navigate(['/profile']);
          },
          error: (error) => {
            this.alertService.error(error);
            this.submitting = false;
          }
        });
    }
  }

  onCancel() {
    this.router.navigate(['/profile']);
  }

  onImageChange(event: any) {
    const currentUser = this.accountService.accountValue;
    
    if (currentUser && currentUser.id && event && event.file) {
        console.log('[AccountSettings] Processing image upload:', {
            userId: currentUser.id,
            email: currentUser.email,
            file: event.file.name
        });

        const profileName =
          (currentUser?.firstName && currentUser.firstName.trim()) ||
          (currentUser?.email && currentUser.email.trim()) ||
          'profile';
        console.log('Uploading profile image with profileName:', profileName);
        const formData = new FormData();
        formData.append('profileImage', event.file);
        formData.append('userId', currentUser.id);
        formData.append('userEmail', currentUser.email || '');
        formData.append('profileName', profileName);
        
        this.accountService.uploadImage(currentUser.id, formData)
            .pipe(first())
            .subscribe({
                next: (response) => {
                    console.log('[AccountSettings] Upload successful:', response);
                    this.alertService.success('Profile image uploaded successfully');
                    // Update the image in the account object so it displays immediately
                    if (response.profileImage) {
                        this.account.profileImage = response.profileImage;
                    }
                },
                error: (error) => {
                    console.error('[AccountSettings] Upload failed:', error);
                    this.alertService.error(error);
                }
            });
    } else {
        console.error('[AccountSettings] Invalid upload state:', {
            hasCurrentUser: !!currentUser,
            hasUserId: currentUser?.id,
            hasEvent: !!event,
            hasFile: event?.file
        });
    }
  }

  onImageRemove() {
    const currentUser = this.accountService.accountValue;
    
    if (currentUser && currentUser.id) {
      this.account.profileImage = null;
      
      // We need to save the account to actually remove the image
      this.accountService.update(currentUser.id, { profileImage: null })
        .pipe(first())
        .subscribe({
          next: () => {
            this.alertService.success('Profile image removed');
          },
          error: (error) => {
            this.alertService.error(error);
          }
        });
    }
  }

  fixProfileImage() {
    if (this.account?.id) {
        this.accountService.fixProfileImage(this.account.id)
            .pipe(first())
            .subscribe({
                next: (response) => {
                    this.alertService.success('Profile image path fixed successfully');
                    if (response.profileImage) {
                        this.account.profileImage = response.profileImage;
                    }
                },
                error: (error) => {
                    this.alertService.error(error);
                }
            });
    }
  }
} 