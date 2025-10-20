import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';
import { UploadService } from '@app/_services/upload.service';

@Component({
  selector: 'app-new-register',
  templateUrl: './new-register.component.html',
  styleUrls: ['./new-register.component.css']
})
export class NewRegisterComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  submitted = false;
  submitting = false;
  imageUrl: string | null = null;
  profileImageFile: File | null = null;
  tempProfileImagePath: string | null = null;
  error: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private accountService: AccountService,
    private alertService: AlertService,
    private uploadService: UploadService
  ) { }

  ngOnInit() {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue]
    }, {
      validator: MustMatch('password', 'confirmPassword')
    });
  }

  // convenience getter for easy access to form fields
  get f() { return this.form.controls; }

  onImageChange(event: any): void {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Prevent duplicate upload if the same file is selected again
      if (this.profileImageFile && this.profileImageFile.name === file.name && this.tempProfileImagePath) {
        event.target.value = '';
        return;
      }
      const email = this.form.get('email')?.value;
      const firstname = this.form.get('firstName')?.value;
      const lastname = this.form.get('lastName')?.value;
      if (!email && (!firstname || !lastname)) {
        this.error = 'Please enter either an email or both first and last name before uploading an image';
        event.target.value = '';
        return;
      }
      this.profileImageFile = file;
      this.uploadService.uploadTempProfileImage(file, email, firstname, lastname).subscribe({
        next: (res: any) => {
          this.error = null;
          this.tempProfileImagePath = res.path || res.filename || null;
          // Create preview
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.imageUrl = e.target.result as string;
          };
          reader.readAsDataURL(file);
          event.target.value = '';
        },
        error: (err) => {
          this.error = err.error?.message || 'Image upload failed';
          event.target.value = '';
          this.profileImageFile = null;
          this.imageUrl = null;
        }
      });
    }
  }

  onImageRemove(): void {
    this.imageUrl = null;
    this.profileImageFile = null;
    this.tempProfileImagePath = null;
  }

  onSubmit() {
    this.submitted = true;
    this.alertService.clear();
    if (this.form.invalid) {
      return;
    }
    this.submitting = true;
    const payload = { ...this.form.value };
    if (this.tempProfileImagePath) {
      payload.profileImage = this.tempProfileImagePath;
    }
    this.accountService.register(payload)
      .pipe(first())
      .subscribe({
        next: () => {
          this.alertService.success('Registration successful', { keepAfterRouteChange: true });
          this.router.navigate(['../login'], { relativeTo: this.router.routerState.root });
        },
        error: error => {
          this.alertService.error(error);
          this.submitting = false;
        }
      });
  }
}
