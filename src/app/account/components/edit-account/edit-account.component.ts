import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services/alert.service';
import { Role } from '@app/_models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-account',
  templateUrl: './edit-account.component.html',
  styleUrls: ['./edit-account.component.css']
})
export class EditAccountComponent implements OnInit, OnChanges {
  @Input() account: any = null;
  @Input() loading = false;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  submitted = false;
  submitting = false;
  imageUrl: string | null = null;
  profileImageFile: File | null = null;
  imageConflict = false;
  imageConflictMessage = '';
  error = '';
  isCurrentUserAdmin = false;
  Role = Role;

  constructor(
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isCurrentUserAdmin = this.accountService.legacyIsAdmin;
    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: [Role.User, Validators.required],
      password: ['', [Validators.minLength(6)]],
      confirmPassword: ['']
    }, {
      validators: this.mustMatch('password', 'confirmPassword')
    });
    if (this.account) {
      this.patchForm(this.account);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.account && changes.account.currentValue) {
      this.patchForm(changes.account.currentValue);
    }
  }

  patchForm(account: any) {
    this.form.patchValue({
      firstName: account.firstName || '',
      lastName: account.lastName || '',
      email: account.email || '',
      role: account.role || Role.User
    });
    if (account.profileImage) {
      this.imageUrl = account.profileImage;
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

  onImageChange(event: any) {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      this.profileImageFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUrl = e.target.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onImageRemove() {
    this.imageUrl = null;
    this.profileImageFile = null;
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      this.alertService.error('Please fix the errors in the form before saving.');
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const formData = { ...this.form.getRawValue() };
    if (!this.isCurrentUserAdmin) {
      delete formData.role;
    }
    // Optionally handle image upload here if needed
    this.save.emit(formData);
  }

  onCancel() {
    this.cancel.emit();
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
}
