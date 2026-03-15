import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { MustMatch } from '../../../_helpers/must-match.validator';
import { PROFILE_TEMPLATES, ProfileTemplate, ProfileTemplateType } from '@app/_models/profile-template';
import { environment } from '@environments/environment';
import { FormsModule } from '@angular/forms';
import { FollowerImage } from '@app/_models/account';
import { UploadService } from '@app/_services/upload.service';
import { AlertService } from '@app/_services/alert.service';
import { AccountService } from '@app/_services/account.service';
import { Account, AccountUpdate } from '@app/_models/account';
import { first } from 'rxjs/operators';
import { Role } from '@app/_models';
import { Router, ActivatedRoute } from '@angular/router';

// Extending FollowerImage for local use
export interface Follower extends FollowerImage {
  imageFile?: File;
  email?: string;
}

export enum EditMode {
  PROFILE = 'profile',
  ACCOUNT = 'account'
}

interface AccountFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  password?: string;
  confirmPassword?: string;
}

interface EditContentState {
  id?: string;
  title: string;
  loading: boolean;
  submitting: boolean;
  submitted: boolean;
  isCurrentUserAdmin: boolean;
}

@Component({
  selector: 'app-edit-content',
  templateUrl: './edit-content.component.html',
  styleUrls: ['./edit-content.component.css']
})
export class EditContentComponent implements OnInit, OnChanges, EditContentState {
  @Input() editMode: EditMode = EditMode.PROFILE;
  @Input() isAddMode: boolean = false;
  @Input() initialData: any = null;
  @Input() submitting: boolean = false;
  @Input() loading: boolean = false;
  @Input() submitted: boolean = false;
  @Input() accountId: string | null = null;

  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @Output() imageChange = new EventEmitter<any>();
  @Output() imageRemove = new EventEmitter<void>();

  form!: FormGroup;
  profileTemplates: ProfileTemplate[] = PROFILE_TEMPLATES;
  imageUrl: string | null = null;
  isCurrentUserAdmin: boolean = false;
  Role = Role; // Expose Role enum to template

  // Follower management
  followers: Follower[] = [];
  showFollowerDialog: boolean = false;
  currentFollower: Follower = { name: '', title: '', imageUrl: '', path: '', email: '' };
  editingFollowerIndex: number = -1;
  /** True while a follower image is being uploaded (shows spinner, disables Save). */
  followerUploading: boolean = false;

  // Image upload properties
  imageConflict: boolean = false;
  imageConflictMessage: string = '';
  error: string = '';
  selectedFile: File | null = null;
  pendingFormData: FormData | null = null;

  id?: string;
  title: string = '';

  environment = environment;

  profileImageFile: File | null = null;

  /** Resolve follower image to full URL so it loads from the API origin (fixes broken images on Render). */
  getFollowerImageUrl(follower: { imageUrl?: string; path?: string }): string {
    return this.accountService.getFollowerImageUrl(follower);
  }

  constructor(
    private formBuilder: FormBuilder,
    private uploadService: UploadService,
    private alertService: AlertService,
    public accountService: AccountService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // this.id = this.route.snapshot.params['id']; // REMOVE - Not needed for profile edit, parent provides data
    // this.isAddMode = !this.id; // REMOVE - isAddMode is an @Input

    // Check if current user is admin using Signals
    this.isCurrentUserAdmin = this.accountService.isAdmin();
    console.log('Current user admin status:', this.isCurrentUserAdmin);

    this.initializeForm();
    // this.title = this.isAddMode ? 'Add User' : 'Edit User'; // REMOVE - Title is handled by getPageTitle()

    if (this.accountId) {
      this.accountService.getById(this.accountId).subscribe(profile => {
        // this.profile = profile; // (remove or fix this line if 'profile' is not a property)
        this.followers = profile.followerImages || [];
      });
    }

    // REMOVE Redundant getById call - Data should come from initialData Input
    /*
    if (!this.isAddMode && this.id) {
      this.loading = true;
      this.accountService.getById(this.id)
        .pipe(first())
        .subscribe({
          next: (account: Account) => {
            this.patchFormValues(account);
            this.loading = false;
          },
          error: error => {
            this.alertService.error(error);
            this.loading = false;
          }
        });
    }
    */
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If initialData changes and the component is already initialized
    if (changes.initialData && this.form) {
       // Check if initialData has a value and it's not the first change (form is ready)
       if (changes.initialData.currentValue && !changes.initialData.firstChange) {
         this.updateDataFromInput();
       } else if (changes.initialData.currentValue && changes.initialData.firstChange) {
         // Handle the very first data received, might need immediate update
         this.updateDataFromInput();
       }
    }
  }

  /**
   * Prevents wheel scrolling on the main container
   * This stops the page from scrolling up and covering the menu
   */
  preventWheelScroll(event: WheelEvent): void {
    if (this.editMode === EditMode.ACCOUNT) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handles keyboard events within the scrollable form container
   * This enables proper keyboard navigation within the form
   */
  handleKeyboardEvents(event: KeyboardEvent): void {
    // Allow all keyboard events within the scrollable container
    // The event will propagate but be caught by our global handler
    // if it's a navigation key that would cause page scrolling
    event.stopPropagation();
  }

  /**
   * Allows wheel scrolling within the scrollable form container
   * This enables scrolling of form content while preventing the page scroll
   */
  allowWheelScroll(event: WheelEvent): void {
    // Don't stop propagation, but let the event bubble naturally
    // This allows scrolling within the container
    event.stopPropagation();
  }

  private updateDataFromInput(): void {
    if (this.initialData) {
      // Ensure this.id is set from initialData when editing
      if (this.initialData.id) {
        this.id = this.initialData.id;
      }
      console.log('EditContentComponent - Initial data received, updating form:', this.initialData); // Modified log

      // Patch the form with all available data
      this.patchFormValues(this.initialData); // ADDED THIS LINE

      // Set the image URL from profile data (resolve to full URL so it works on Render)
      if (this.initialData.profileImage) {
        this.imageUrl = this.accountService.getProfileImageUrl(this.initialData.profileImage);
      } else {
        this.imageUrl = null;
      }
      console.log('EditContentComponent - Image URL set to:', this.imageUrl);

      // Load existing followers if available
      this.followers = []; // Clear existing followers before loading new ones
      if (this.initialData.followerImages && Array.isArray(this.initialData.followerImages)) {
        // Ensure we have a deep copy to avoid modifying the original input data
        this.followers = JSON.parse(JSON.stringify(this.initialData.followerImages));
      }
       console.log('EditContentComponent - Followers set to:', this.followers);
    } else {
       console.log('EditContentComponent - Initial data is null, cannot update form.');
    }
  }

  private initializeForm() {
    const roleControl = {
      value: Role.User,
      disabled: !this.isCurrentUserAdmin
    };

    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: [roleControl.value, { disabled: roleControl.disabled }],
      password: ['', [Validators.minLength(6), ...(!this.isAddMode ? [] : [Validators.required])]],
      confirmPassword: [''],

      // Profile template type
      profileTemplateType: [ProfileTemplateType.STANDARD],

      // Contact Information
      address: [''],
      city: [''],
      state: [''],
      zipCode: [''],
      phone: [''],
      mobile: [''],

      // Professional Information
      position: [''],
      company: [''],
      bio: [''],
      skills: [{ value: '', disabled: true }], // Initially disabled, enabled for Business Card template

      // Social Media Information
      website: [''],
      twitter: [''],
      facebook: [''],
      instagram: [''],
      github: [''],
      linkedin: [''],
      followersCount: [{ value: 0, disabled: true }], // Initially disabled, enabled for Social Media template
      followingCount: [{ value: 0, disabled: true }]  // Initially disabled, enabled for Social Media template
    }, {
      validator: MustMatch('password', 'confirmPassword')
    });

    // Initialize form based on template type
    this.onTemplateChange();

    console.log('Form initialized with role control disabled:', !this.isCurrentUserAdmin);
  }

  private patchFormValues(account?: Account) {
    if (!account) {
        console.warn('No account data provided for patch');
        return;
    }

    console.log('Patching form values with account:', account);

    // Use getRawValue to include disabled fields like 'role' if needed during patching
    const currentFormValues = this.form.getRawValue();

    // Prepare the values to patch, including all fields from the Account model
    const formValuesToPatch: Partial<Account> & { profileTemplateType?: ProfileTemplateType } = {
        firstName: account.firstName || '',
        lastName: account.lastName || '',
        email: account.email || '',
        role: account.role as Role, // Keep role from account data
        profileTemplateType: account.profileTemplateType || ProfileTemplateType.STANDARD,
        address: account.address || '',
        city: account.city || '',
        state: account.state || '',
        zipCode: account.zipCode || '',
        phone: account.phone || '',
        mobile: account.mobile || '',
        position: account.position || '',
        company: account.company || '',
        bio: account.bio || '',
        skills: account.skills || [], // Assign array directly, or empty array
        website: account.website || '',
        twitter: account.twitter || '',
        facebook: account.facebook || '',
        instagram: account.instagram || '',
        github: account.github || '',
        linkedin: account.linkedin || '',
        followersCount: account.followersCount || 0,
        followingCount: account.followingCount || 0
    };

    // Only patch values that are different from the current form values
    // or if the field is explicitly part of the account data being passed in.
    // This avoids overwriting user input unnecessarily if patchFormValues is called multiple times.
    const finalPatchValues: any = {};
    for (const key in formValuesToPatch) {
      if (formValuesToPatch.hasOwnProperty(key) &&
          (currentFormValues[key] !== formValuesToPatch[key as keyof typeof formValuesToPatch] || account.hasOwnProperty(key))) {
            finalPatchValues[key] = formValuesToPatch[key as keyof typeof formValuesToPatch];
      }
    }

    console.log('Final values being patched:', finalPatchValues);
    this.form.patchValue(finalPatchValues);

    // Re-evaluate template-based field states after patching
    this.onTemplateChange();

    // Ensure role is correctly set and disabled status is maintained
    const roleControl = this.form.get('role');
    if (roleControl) {
        roleControl.setValue(account.role as Role, { emitEvent: false }); // Set value without triggering change event loop
        if (!this.isCurrentUserAdmin) {
            roleControl.disable({ emitEvent: false });
        } else {
            roleControl.enable({ emitEvent: false });
        }
    }

    console.log('Role value after patch:', this.form.get('role')?.value, 'Disabled:', this.form.get('role')?.disabled);
  }

  // convenience getter for easy access to form fields
  get f() { return this.form.controls; }

  // Template type checkers
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

  // Event handlers
  onSubmit() {
    this.submitted = true;
    // Removed form validation check to allow processing regardless of validity
    console.log('[onSubmit] Starting submit process:', {
      id: this.id,
      isAddMode: this.isAddMode,
      initialDataId: this.initialData?.id,
      profileImageFile: this.profileImageFile ? {
        name: this.profileImageFile.name,
        size: this.profileImageFile.size,
        type: this.profileImageFile.type
      } : null,
      formProfileImage: this.form.get('profileImage')?.value
    });

    const handleError = (error: any) => {
      let message = 'An error occurred while saving.';
      if (error && error.error) {
        if (typeof error.error === 'string') {
          message = error.error;
        } else if (error.error.message) {
          message = error.error.message;
        }
      } else if (typeof error === 'string') {
        message = error;
      }
      console.error('[onSubmit] Error occurred:', error);
      this.alertService.error(message);
    };

    const handleSuccess = (account: any) => {
      console.log('[onSubmit] Account saved successfully:', account);
      this.alertService.success('Account saved successfully');
      // Navigate back to the appropriate page
      if (this.editMode === EditMode.ACCOUNT) {
        this.router.navigate(['/admin/accounts']);
      } else if (this.editMode === EditMode.PROFILE) {
        this.router.navigate(['/profile']);
      }
    };

    if (this.profileImageFile) {
      console.log('[onSubmit] Uploading profile image:', {
        fileName: this.profileImageFile.name,
        size: this.profileImageFile.size,
        type: this.profileImageFile.type
      });
      const formData = new FormData();
      formData.append('profileImage', this.profileImageFile);
      formData.append('userEmail', this.form.get('email')?.value || '');
      if (this.id) {
        formData.append('userId', this.id);
      }
      console.log('[onSubmit] Created FormData with:', {
        hasProfileImage: formData.has('profileImage'),
        userEmail: this.form.get('email')?.value,
        userId: this.id
      });
      // Use hybrid upload (S3 + local) so the image is stored in the cloud and persists
      (this.id ? this.accountService.uploadImage(this.id, formData) : this.uploadService.uploadProfileImage(this.profileImageFile, formData))
        .pipe(first())
        .subscribe({
          next: (response) => {
            console.log('[onSubmit] Profile image upload response:', response);
            if (response && response.profileImage) {
              this.form.patchValue({ profileImage: response.profileImage });
              // Update displayed image immediately so the view shows the new upload (full URL for Render)
              this.imageUrl = this.accountService.getProfileImageUrl(response.profileImage);
            }
            this.profileImageFile = null;
            console.log('[onSubmit] Calling saveAccount after successful image upload');
            this.saveAccount().subscribe({
              next: handleSuccess,
              error: handleError
            });
          },
          error: (error) => {
            console.error('[onSubmit] Profile image upload failed:', error);
            this.alertService.error('Image upload failed');
            this.saveAccount().subscribe({
              next: handleSuccess,
              error: handleError
            });
          }
        });
    } else {
      console.log('[onSubmit] No profile image to upload, saving account directly');
      this.saveAccount().subscribe({
        next: handleSuccess,
        error: handleError
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  onImageChange(event: any) {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      this.profileImageFile = file;
      // Check if this is the same image
      if (this.initialData?.profileImage) {
        this.imageConflict = true;
        this.imageConflictMessage = 'There is already an image for this account, do you want to overwrite it?';
        this.selectedFile = file;
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUrl = e.target.result as string;
        this.imageChange.emit({
          file: file,
          dataUrl: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  }

  confirmOverwrite() {
    console.log('[confirmOverwrite] Starting overwrite process:', {
      selectedFile: this.selectedFile ? {
        name: this.selectedFile.name,
        size: this.selectedFile.size,
        type: this.selectedFile.type
      } : null,
      currentProfileImageFile: this.profileImageFile ? {
        name: this.profileImageFile.name,
        size: this.profileImageFile.size,
        type: this.profileImageFile.type
      } : null
    });

    if (!this.selectedFile) {
      console.error('[confirmOverwrite] No file selected for overwrite');
      this.alertService.error('No file selected for overwrite');
      return;
    }

    this.profileImageFile = this.selectedFile;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imageUrl = e.target.result as string;
      this.imageChange.emit({
        file: this.selectedFile,
        dataUrl: e.target.result,
        confirmed: true
      });
      console.log('[confirmOverwrite] File loaded and preview updated:', {
        imageUrl: this.imageUrl,
        profileImageFile: this.profileImageFile ? {
          name: this.profileImageFile.name,
          size: this.profileImageFile.size,
          type: this.profileImageFile.type
        } : null
      });
    };
    reader.readAsDataURL(this.selectedFile);
    this.imageConflict = false;
    this.imageConflictMessage = '';
    this.selectedFile = null;
  }

  cancelOverwrite() {
    this.imageConflict = false;
    this.imageConflictMessage = '';
    this.selectedFile = null;
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  onImageRemove() {
    this.imageUrl = null;
    this.imageRemove.emit();
  }

  onTemplateChange() {
    const templateType = this.form.get('profileTemplateType')?.value;
    console.log('Template changed to:', templateType);

    // Update form validation and UI based on template type
    if (this.isSocialMediaTemplate()) {
      // Enable social media specific fields
      this.form.get('followersCount')?.enable();
      this.form.get('followingCount')?.enable();
      this.form.get('skills')?.disable();

      // Social media fields are NO LONGER required
      // this.form.get('twitter')?.setValidators([Validators.required]); // REMOVED
      // this.form.get('instagram')?.setValidators([Validators.required]); // REMOVED

      // Show follower section
      console.log('Enabling social media features (Twitter/Instagram now optional)'); // Updated log
    } else if (this.isBusinessCardTemplate()) {
      // Enable business card specific fields
      this.form.get('followersCount')?.disable();
      this.form.get('followingCount')?.disable();
      this.form.get('skills')?.enable();

      // Business fields are required
      this.form.get('position')?.setValidators([Validators.required]);
      this.form.get('company')?.setValidators([Validators.required]);
      this.form.get('skills')?.setValidators([Validators.required]);

      // Remove social media requirements (if they were previously set)
      this.form.get('twitter')?.clearValidators();
      this.form.get('instagram')?.clearValidators();

      console.log('Enabling business card features');
    } else {
      // Standard template - disable special features
      this.form.get('followersCount')?.disable();
      this.form.get('followingCount')?.disable();
      this.form.get('skills')?.disable();

      // Clear special requirements
      this.form.get('position')?.clearValidators();
      this.form.get('company')?.clearValidators();
      this.form.get('skills')?.clearValidators();
      this.form.get('twitter')?.clearValidators(); // Ensure these are cleared for Standard too
      this.form.get('instagram')?.clearValidators(); // Ensure these are cleared for Standard too

      console.log('Using standard template features');
    }

    // Update all validators
    ['position', 'company', 'skills', 'twitter', 'instagram'].forEach(field => {
      this.form.get(field)?.updateValueAndValidity();
    });

    // Force change detection
    this.form.updateValueAndValidity();
  }

  // Utility methods for template
  getPageTitle() {
    if (this.editMode === EditMode.PROFILE) {
      return 'Update Profile';
    } else {
      return this.isAddMode ? 'Create Account' : 'Edit Account';
    }
  }

  showField(fieldName: string): boolean {
    // Determine if a field should be shown based on edit mode and template
    switch (fieldName) {
      case 'role':
        return this.editMode === EditMode.ACCOUNT;
      case 'skills':
        return this.isBusinessCardTemplate();
      case 'followersCount':
      case 'followingCount':
        return this.isSocialMediaTemplate();
      default:
        return true;
    }
  }

  // Follower management methods
  hasFollowers(): boolean {
    return this.followers && this.followers.length > 0;
  }

  openFollowerDialog(): void {
    console.log('[EditContentComponent] openFollowerDialog called');
    this.currentFollower = { name: '' };
    this.editingFollowerIndex = -1;
    this.showFollowerDialog = true;
  }

  closeFollowerDialog(): void {
    this.showFollowerDialog = false;
    this.followerUploading = false;
  }

  editFollower(index: number): void {
    if (index >= 0 && index < this.followers.length) {
      this.currentFollower = { ...this.followers[index] };
      // Ensure imageUrl is set for the dialog preview
      if (!this.currentFollower.imageUrl && this.currentFollower.path) {
        this.currentFollower.imageUrl = this.environment.apiUrl + '/' + this.currentFollower.path;
      }
      this.editingFollowerIndex = index;
      this.showFollowerDialog = true;
    }
  }

  removeFollower(index: number): void {
    if (index >= 0 && index < this.followers.length) {
      this.followers.splice(index, 1);
    }
  }

  saveFollower(): void {
    // Disable Save on first click when uploading an image (prevents double/triple submit)
    if (this.currentFollower.imageFile) {
      this.followerUploading = true;
      this.cdr.detectChanges();
    }
    if (!this.currentFollower.name) {
        if (this.currentFollower.imageFile) this.followerUploading = false;
        alert('Follower name is required');
        return;
    }
    // Upload image (button already disabled above)
    if (this.currentFollower.imageFile) {
      console.log('Uploading follower image for:', this.currentFollower.name);
      this.accountService.uploadFollowerImageHybrid(
        this.currentFollower.imageFile!,
        this.currentFollower.name ?? '',
        this.currentFollower.title ?? ''
      )
      .pipe(first())
      .subscribe({
        next: (follower) => {
          console.log('Follower image uploaded successfully:', follower);
          this.currentFollower.id = follower.id;
          this.currentFollower.path = follower.path;
          this.currentFollower.imageUrl = follower.imageUrl || this.accountService.getFollowerImageUrl({ imageUrl: follower.imageUrl, path: follower.path });
          // Keep spinner/disabled until modal closes (reset in closeFollowerDialog)
          this.saveFollowerToList();
        },
        error: (error) => {
          console.error('Failed to upload follower image', error);
          this.followerUploading = false;
          if (!this.currentFollower.id) {
            this.currentFollower.id = Date.now().toString();
          }
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.currentFollower.imageUrl = e.target.result;
            this.saveFollowerToList();
            alert('Could not upload the follower image to the server, but the follower has been saved with a local image. The image may not persist after page refresh. Error: ' + (error.message || 'Unknown error'));
          };
          reader.readAsDataURL(this.currentFollower.imageFile as File);
        }
      });
    } else {
      if (!this.currentFollower.id) {
        this.currentFollower.id = Date.now().toString();
      }
      this.saveFollowerToList();
    }
  }

  // Helper method to save follower to the list
  private saveFollowerToList(): void {
    const followerData = {
      id: this.currentFollower.id || Date.now().toString(),
      name: this.currentFollower.name,
      title: this.currentFollower.title || '',
      imageUrl: this.currentFollower.imageUrl || '',
      path: this.currentFollower.path || ''
    };

    if (this.editingFollowerIndex >= 0) {
      // Update existing follower
      this.followers[this.editingFollowerIndex] = followerData;
    } else {
      // Add new follower
      this.followers.push(followerData);
    }

    this.closeFollowerDialog();
  }

  onFollowerImageChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result as string;
        console.log('[EditContentComponent] Generated Follower Image Data URL (length: ' + dataUrl.length + '):', dataUrl.substring(0, 100) + '...'); // Log start of URL
        this.currentFollower.imageUrl = dataUrl;
        this.currentFollower.imageFile = file;
      };
      reader.readAsDataURL(file);
    }
  }

  // Handle role changes
  onRoleChange(event: any) {
    if (!this.isCurrentUserAdmin) {
        console.log('[DEBUG] Non-admin tried to change role - reverting');
        const roleControl = this.form.get('role');
        if (roleControl) {
            roleControl.setValue(this.initialData?.role || Role.User, { emitEvent: false });
        }
        return;
    }

    const newRole = event.target.value;
    console.log('[DEBUG] Role change by admin:', {
        newRole,
        oldRole: this.initialData?.role,
        formValue: this.form.get('role')?.value
    });
  }

  // Add this getter to filter role options based on user permissions
  get availableRoles(): Role[] {
    if (this.isCurrentUserAdmin) {
      return [Role.Admin, Role.User];
    }
    return [Role.User];
  }

  private saveAccount() {
    const formData = this.form.getRawValue() as AccountUpdate;
    if (!this.isCurrentUserAdmin) {
      delete formData.role;
    }
    const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            if (Array.isArray(value) || typeof value === 'object') {
                acc[key as keyof AccountUpdate] = value;
            } else {
                acc[key as keyof AccountUpdate] = value;
            }
        }
        return acc;
    }, {} as AccountUpdate);

    // Ensure profileImage is included if it exists in the form
    if (this.form.get('profileImage')?.value) {
        cleanedData.profileImage = this.form.get('profileImage')?.value;
    }

    if (this.followers.length > 0) {
        cleanedData.followerImages = this.followers.map(follower => ({
            id: follower.id,
            name: follower.name,
            title: follower.title || '',
            imageUrl: follower.imageUrl || '',
            path: follower.path || ''
        }));
    }
    console.log('[saveAccount] this.id:', this.id, '| Will call:', this.id ? 'update (PUT)' : 'create (POST)', '| Data:', cleanedData);
    return this.id
        ? this.accountService.update(this.id, cleanedData)
        : this.accountService.create(cleanedData);
  }
}
