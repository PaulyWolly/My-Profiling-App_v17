import { Component, OnInit, HostListener, OnDestroy, Renderer2 } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService } from '../../../../_services/account.service';
import { AlertService } from '../../../../_services/alert.service';
import { MustMatch } from '../../../../_helpers/must-match.validator';
import { Account } from '../../../../_models/account';
import { Role } from '../../../../_models/role';
import { environment } from '../../../../../environments/environment';
import { PROFILE_TEMPLATES, ProfileTemplate, ProfileTemplateType } from '@app/_models/profile-template';
import { EditMode } from '@app/shared/components/edit-content/edit-content.component';
import { UploadService } from '@app/_services/upload.service';

@Component({
    templateUrl: './add-edit.component.html',
    styleUrls: ['./add-edit.component.css']
})
export class AddEditComponent implements OnInit, OnDestroy {
    title!: string;
    id?: string;
    form!: FormGroup;
    loading = false;
    submitting = false;
    submitted = false;
    account: any = null;
    selectedFile: File | null = null;
    previewUrl: string | null = null;
    uploading = false;
    error = '';
    isAddMode = true;
    imageConflict = false;
    imageConflictMessage = '';
    pendingFormData: FormData | null = null;
    profileTemplates: ProfileTemplate[] = PROFILE_TEMPLATES;
    imageUrl: string | null = null;
    editMode = EditMode.ACCOUNT;
    private bodyOriginalStyle: { [key: string]: string } = {};
    Role = Role; // Expose Role enum to the template
    currentUserRole: Role = Role.User;
    pendingProfileImagePath: string | null = null;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        private renderer: Renderer2,
        private uploadService: UploadService
    ) { }

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];
        this.isAddMode = !this.id;
        this.title = this.isAddMode ? 'Create Account' : 'Edit Account';

        // Get the current user's role
        const currentUser = this.accountService.accountValue;
        if (currentUser && currentUser.role) {
            this.currentUserRole = currentUser.role;
        }

        // Disable page scrolling
        this.disablePageScrolling();

        // password not required in edit mode
        const passwordValidators = [Validators.minLength(6)];
        if (this.isAddMode) {
            passwordValidators.push(Validators.required);
        }

        this.form = this.formBuilder.group({
            firstName: [''],
            lastName: [''],
            email: ['', [Validators.email]],
            role: [''],
            password: [''],
            confirmPassword: [''],
            company: [''],
            position: [''],
            address: [''],
            city: [''],
            state: [''],
            zipCode: [''],
            website: [''],
            github: [''],
            twitter: [''],
            instagram: [''],
            facebook: [''],
            linkedin: [''],
            bio: [''],
            education: [null],
            followerImages: [[]]
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });

        if (!this.isAddMode && this.id) {
            this.loading = true;
            this.accountService.getById(this.id)
                .pipe(first())
                .subscribe({
                    next: (account) => {
                        console.log('Account data received:', account);
                        this.account = {...account}; // Create a copy of the account
                        // Format profile image URL if needed
                        if (account.profileImage) {
                            if (!account.profileImage.startsWith('http') && !account.profileImage.startsWith('data:')) {
                                this.account.profileImage = `${environment.apiUrl}/${account.profileImage}`;
                            }
                            console.log('Formatted image URL:', this.account.profileImage);
                        }
                        this.imageUrl = this.account.profileImage || null;
                        // Patch all fields, not just the original ones
                        this.form.patchValue({
                            firstName: account.firstName || '',
                            lastName: account.lastName || '',
                            email: account.email || '',
                            role: account.role || '',
                            company: account.company || '',
                            position: account.position || '',
                            address: account.address || '',
                            city: account.city || '',
                            state: account.state || '',
                            zipCode: account.zipCode || '',
                            website: account.website || '',
                            github: account.github || '',
                            twitter: account.twitter || '',
                            instagram: account.instagram || '',
                            facebook: account.facebook || '',
                            linkedin: account.linkedin || '',
                            bio: account.bio || '',
                            education: account.education || null,
                            followerImages: account.followerImages || []
                        });
                        this.loading = false;
                    },
                    error: error => {
                        this.alertService.error(error);
                        this.loading = false;
                    }
                });
        }
    }

    ngOnDestroy() {
        // Restore page scrolling
        this.restorePageScrolling();
    }

    // Completely disable page scrolling
    private disablePageScrolling() {
        const body = document.body;
        this.bodyOriginalStyle = {
            overflow: body.style.overflow,
            position: body.style.position,
            height: body.style.height,
            width: body.style.width
        };

        this.renderer.setStyle(body, 'overflow', 'hidden');
        this.renderer.setStyle(body, 'position', 'fixed');
        this.renderer.setStyle(body, 'width', '100%');
        this.renderer.setStyle(body, 'height', '100%');
        
        // Add CSS class to body for additional styling
        this.renderer.addClass(body, 'edit-account-page');

        // Add a global event listeners for wheel and keyboard events
        document.addEventListener('wheel', this.preventScroll, { passive: false });
        document.addEventListener('keydown', this.preventArrowScroll, { passive: false });
    }

    // Restore original page scrolling
    private restorePageScrolling() {
        const body = document.body;
        
        for (const [prop, value] of Object.entries(this.bodyOriginalStyle)) {
            if (value) {
                this.renderer.setStyle(body, prop, value);
            } else {
                this.renderer.removeStyle(body, prop);
            }
        }
        
        // Remove the CSS class
        this.renderer.removeClass(body, 'edit-account-page');

        // Remove the global event listeners
        document.removeEventListener('wheel', this.preventScroll);
        document.removeEventListener('keydown', this.preventArrowScroll);
    }

    // Global wheel event handler
    private preventScroll = (event: WheelEvent) => {
        // Only allow wheel events in scrollable form containers
        if (!this.isEventInScrollableArea(event.target as HTMLElement)) {
            event.preventDefault();
            return false;
        }
        return true;
    }
    
    // Global keyboard event handler to prevent arrow key scrolling
    private preventArrowScroll = (event: KeyboardEvent) => {
        // Arrow keys and space
        const scrollKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' ', 'PageUp', 'PageDown', 'Home', 'End'];
        
        if (scrollKeys.includes(event.key) && !this.isInputElement(event.target as HTMLElement)) {
            // Prevent arrow keys from scrolling the page
            // But allow if focus is in a form control (input, textarea, select)
            event.preventDefault();
            return false;
        }
        return true;
    }
    
    // Helper method to check if element is a form control
    private isInputElement(element: HTMLElement | null): boolean {
        if (!element) return false;
        
        const formElements = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
        
        // First check if element is directly a form element
        if (formElements.includes(element.tagName)) {
            return true;
        }
        
        // Then check if it's in a scrollable container
        if (this.isEventInScrollableArea(element)) {
            return true;
        }
        
        return false;
    }

    // Helper method to check if event is in a scrollable area
    private isEventInScrollableArea(element: HTMLElement | null): boolean {
        if (!element) return false;
        
        // Check if element or any parent has the class 'scrollable-form-container'
        while (element && element !== document.body) {
            if (element.classList && element.classList.contains('scrollable-form-container')) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onImageChange(event: any) {
        if (event && event.file) {
            // Validate file type
            if (!event.file.type.match(/image\/*/) || !event.file.type.match(/\/(jpg|jpeg|png|gif)$/)) {
                this.alertService.error('Please select a valid image file (jpg, jpeg, png, or gif)');
                return;
            }
            // Validate file size (5MB max)
            if (event.file.size > 5 * 1024 * 1024) {
                this.alertService.error('File size must be less than 5MB');
                return;
            }

            // Store the file and preview URL
            this.selectedFile = event.file;
            this.imageUrl = event.dataUrl;
            
            // If we have a path from the child component's upload, store it
            if (event.path) {
                this.pendingProfileImagePath = event.path;
            }
        }
    }

    confirmOverwrite() {
        if (this.pendingFormData) {
            // Update the confirmed flag in the existing FormData
            this.pendingFormData.set('confirmed', 'true');
        
        this.uploading = true;
            this.accountService.uploadImage(this.id!, this.pendingFormData)
                .pipe(first())
                .subscribe({
                    next: (response) => {
                        if (response.profileImage) {
                            // Update the account's profile image
                            this.account.profileImage = response.profileImage;
                            this.imageUrl = response.profileImage;
                            
                            // Clear states
                            this.imageConflict = false;
                            this.selectedFile = null;
                            this.pendingFormData = null;
                            
                            // Show success alert
                            this.alertService.success(response.message || 'Profile image uploaded successfully');
                            
                            // Save the account to persist the changes
                            this.saveAccount(this.form.value)
                                .pipe(first())
                                .subscribe({
                                    next: () => {
                                        console.log('[AddEdit] Account saved with new image');
                                    },
                                    error: error => {
                                        console.error('[AddEdit] Error saving account:', error);
                                        this.alertService.error('Failed to save account changes');
                                    }
                                });
                        }
                        this.uploading = false;
                    },
                    error: (error) => {
                        console.error('[AddEdit] Upload error:', error);
            this.error = error.message || 'Failed to upload image';
                        this.alertService.error(this.error);
            this.uploading = false;
                    }
                });
        }
    }

    cancelOverwrite() {
        this.imageConflict = false;
        this.imageConflictMessage = '';
        this.selectedFile = null;
        this.pendingFormData = null;
        // Reset the file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    onSave(formData: any) {
        this.submitted = true;
        
        // reset alerts on submit
        this.alertService.clear();
        
        this.submitting = true;
        this.saveAccount(formData)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Account saved', { keepAfterRouteChange: true });
                    this.router.navigate(['/admin/accounts']);
                },
                error: error => {
                    this.alertService.error(error);
                    this.submitting = false;
                }
            });
    }

    onCancel() {
        this.router.navigate(['/admin/accounts']);
    }

    private saveAccount(formData: any) {
        // Only send editable fields
        const accountData: any = {
            ...formData,
            profileImage: this.pendingProfileImagePath || formData.profileImage
        };

        // Remove undefined fields
        Object.keys(accountData).forEach(
            key => accountData[key] === undefined && delete accountData[key]
        );

        console.log('Payload to update:', accountData);

        return this.isAddMode
            ? this.accountService.create(accountData)
            : this.accountService.update(this.id!, accountData);
    }

    isBusinessCardTemplate() {
        return this.form.get('profileTemplateType')?.value === ProfileTemplateType.BUSINESS_CARD;
    }

    isSocialMediaTemplate() {
        return this.form.get('profileTemplateType')?.value === ProfileTemplateType.SOCIAL_MEDIA;
    }

    isStandardTemplate() {
        return this.form.get('profileTemplateType')?.value === ProfileTemplateType.STANDARD;
    }

    getSelectedTemplateDescription() {
        const templateId = this.form.get('profileTemplateType')?.value;
        const template = this.profileTemplates.find(t => t.id === templateId);
        return template ? template.description : '';
    }

    selectedTemplateChanged() {
        // You can add template-specific logic here
        console.log('Template changed to:', this.form.get('profileTemplateType')?.value);
    }

    onImageRemove() {
        this.selectedFile = null;
        this.imageUrl = null;
        this.pendingFormData = null;
        
        // Update the account object so it passes to the edit-content component
        if (this.account) {
            this.account.profileImage = null;
        }
        
        // Reset the file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.alertService.info('Image removed. Save to apply changes.');
    }

    // Method to get CSS class for role badge
    getRoleBadgeClass(): string {
        const role = this.form?.get('role')?.value;
        
        if (role === Role.Admin) {
            return 'bg-danger'; // Red badge for Admin
        } else if (role === Role.User) {
            return 'bg-success'; // Green badge for User
        }
        
        return 'bg-secondary'; // Default gray badge
    }
    
    // Update the role value when the dropdown selection changes
    updateRole(event: Event) {
        const select = event.target as HTMLSelectElement;
        if (select && this.form) {
            this.form.get('role')?.setValue(select.value);
        }
    }
}
