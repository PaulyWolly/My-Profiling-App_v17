import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Role } from '@app/_models';
import { MustMatch } from '@app/_helpers/must-match.validator';
import { UploadService } from '@app/_services/upload.service';

@Component({
  selector: 'app-new-account-edit',
  templateUrl: './new-account-edit.component.html',
  styleUrls: ['./new-account-edit.component.scss']
})
export class NewAccountEditComponent implements OnInit, OnChanges {
  @Input() account: any = null;
  @Input() loading = false;
  @Input() submitted = false;
  @Input() submitting = false;
  @Input() isAdmin = false; // Whether the current user is an admin
  @Input() isAdminView = false; // Whether we're in the admin section
  @Input() currentUserRole: Role = Role.User; // Add this line

  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @Output() imageChange = new EventEmitter<any>();
  @Output() imageRemove = new EventEmitter<void>();

  form!: FormGroup;
  imageUrl: string | null = null;
  profileImageFile: File | null = null;
  error: string | null = null;
  Role = Role;
  availableRoles = [Role.Admin, Role.User]; // Only Admin and User can be assigned
  tempProfileImagePath: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private uploadService: UploadService
  ) {}

  ngOnInit(): void {
    this.initForm();
    // If this is a new account (no id), reset all fields to default/empty
    if (!this.account || !this.account.id) {
      this.form.reset({
        firstName: '',
        lastName: '',
        email: '',
        role: Role.User,
        password: '',
        confirmPassword: ''
        // Add any other fields here if needed (company, address, skills, etc.)
      });
      this.imageUrl = null;
      this.profileImageFile = null;
      this.error = null;
    } else {
      this.patchForm(this.account);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.account && changes.account.currentValue && this.form) {
      this.patchForm(changes.account.currentValue);
    }
    
    if (changes.submitted && changes.submitted.currentValue) {
      this.validateForm();
    }
  }

  private initForm(): void {
    // Password validations are different for new vs existing accounts
    const passwordValidators = this.account?.id 
      ? [Validators.minLength(6)] // Existing account - password optional but must be valid if provided
      : [Validators.required, Validators.minLength(6)]; // New account - password required
    
    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: [Role.User, Validators.required],
      password: ['', passwordValidators],
      confirmPassword: ['']
    }, {
      validators: this.mustMatch('password', 'confirmPassword')
    });
  }

  private patchForm(account: any): void {
    // Patch all fields from account object
    this.form.patchValue({
      firstName: account.firstName || '',
      lastName: account.lastName || '',
      email: account.email || '',
      role: account.role || Role.User
    });
    
    // Update image if available
    if (account.profileImage) {
      this.imageUrl = account.profileImage;
    }
  }

  private validateForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
    }
  }

  mustMatch(controlName: string, matchingControlName: string) {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl = formGroup.controls[matchingControlName];
      if (matchingControl.errors && !matchingControl.errors.mustMatch) {
        return;
      }
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ mustMatch: true });
      } else {
        matchingControl.setErrors(null);
      }
    };
  }

  get f() { return this.form.controls; }

  onImageChange(event: any): void {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Prevent duplicate upload if the same file is selected again
      if (this.profileImageFile && this.profileImageFile.name === file.name && this.tempProfileImagePath) {
        event.target.value = '';
        return;
      }

      // Get the latest form values
      const email = this.form.get('email')?.value;
      const firstname = this.form.get('firstName')?.value;
      const lastname = this.form.get('lastName')?.value;

      // For admin account creation, we don't require email/name first
      if (!this.isAdminView) {
        // Regular user registration - validate required fields
        if (!email && (!firstname || !lastname)) {
          this.error = 'Please enter either an email or both first and last name before uploading an image';
          event.target.value = '';
          return;
        }
      }

      // Log the values we're sending
      console.log('[NewAccountEdit] Uploading image with:', {
        email,
        firstname,
        lastname,
        hasFile: !!file,
        fileName: file.name,
        isAdminView: this.isAdminView
      });

      this.profileImageFile = file;
      this.uploadService.uploadTempProfileImage(file, email, firstname, lastname).subscribe({
        next: (res: any) => {
          this.error = null;
          this.tempProfileImagePath = res.path || res.filename || null;
          console.log('[NewAccountEdit] Upload successful:', res);
          
          // Create preview and emit change event
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.imageUrl = e.target.result as string;
            // Only emit the change event with the file and data URL
            this.imageChange.emit({
              file,
              dataUrl: this.imageUrl,
              path: this.tempProfileImagePath
            });
          };
          reader.readAsDataURL(file);
          event.target.value = '';
        },
        error: (err) => {
          console.error('[NewAccountEdit] Upload failed:', err);
          this.error = err.error?.message || 'Image upload failed';
          // Clear the file input
          event.target.value = '';
          this.profileImageFile = null;
          this.imageUrl = null;
          this.tempProfileImagePath = null;
        }
      });
    }
  }

  onImageRemove(): void {
    this.imageUrl = null;
    this.profileImageFile = null;
    this.imageRemove.emit();
  }

  onSubmit(): void {
    // Gather form data including possible profile image
    const formData = { ...this.form.getRawValue() };
    // Remove role if not admin
    if (!this.isAdmin && !this.isAdminView) {
      delete formData.role;
    }
    // Include temp profile image path if present
    if (this.tempProfileImagePath) {
      formData.profileImage = this.tempProfileImagePath;
    }
    // Emit save event with form data
    this.save.emit(formData);
  }

  onCancel(): void {
    this.cancel.emit();
  }
  
  // Method to get CSS class for role badge
  getRoleBadgeClass(): string {
    const role = this.form?.get('role')?.value;
    if (role === Role.SuperAdmin) {
      return 'bg-gold'; // Gold badge for Super-Admin
    } else if (role === Role.Admin) {
      return 'bg-danger'; // Red badge for Admin
    } else if (role === Role.User) {
      return 'bg-success'; // Green badge for User
    }
    return 'bg-secondary'; // Default gray badge
  }

  // Update the role from the select element
  updateRole(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select && this.form) {
      this.form.get('role')?.setValue(select.value);
    }
  }

  // Add this method to check if form should be disabled
  isFormDisabled(): boolean {
    // If current user is Admin and viewing a Super-Admin account, disable the form
    return this.currentUserRole === Role.Admin && this.account?.role === Role.SuperAdmin;
  }

  // Add method to check if save button should be disabled
  isSaveDisabled(): boolean {
    return this.isFormDisabled() || this.submitting;
  }

  /**
   * Temp profile upload (server) allows email OR first+last name.
   * Admin "create account" previously required valid email only, which blocked Super-Admin
   * from uploading until every field validated — align UI with server and with name-only temp files.
   */
  isImageControlsDisabled(): boolean {
    if (this.isFormDisabled()) {
      return true;
    }
    const emailCtrl = this.form?.get('email');
    const first = (this.form?.get('firstName')?.value || '').trim();
    const last = (this.form?.get('lastName')?.value || '').trim();
    const emailOk = !!(emailCtrl?.valid && (emailCtrl.value || '').toString().trim());

    if (this.isAdminView && !this.account?.id) {
      const hasNames = !!(first && last);
      return !emailOk && !hasNames;
    }

    return !emailCtrl?.valid;
  }
} 