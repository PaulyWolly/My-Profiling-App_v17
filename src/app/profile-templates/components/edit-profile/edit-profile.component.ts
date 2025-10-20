import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';
import { PROFILE_TEMPLATES, ProfileTemplateType } from '@app/_models/profile-template';
import { FollowerImage, Account } from '@app/_models/account';
import { UploadService } from '@app/_services/upload.service';
import { AlertService } from '@app/_services/alert.service';
import { AccountService } from '@app/_services/account.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() account: Account | null = null;
  @Input() loading = false;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('scrollingDiv') scrollingDiv!: ElementRef;

  form!: FormGroup;
  submitted = false;
  submitting = false;
  profileTemplates = PROFILE_TEMPLATES;
  followers: FollowerImage[] = [];
  showFollowerDialog = false;
  currentFollower: FollowerImage = { name: '', title: '', imageUrl: '', path: '' };
  editingFollowerIndex = -1;
  templateType = ProfileTemplateType.STANDARD;
  imageConflict = false;
  imageConflictMessage = '';
  selectedFile: File | null = null;
  pendingImage: string | null = null;
  highlightSection: string = 'social-media'; // Default, can be set dynamically later

  constructor(
    private formBuilder: FormBuilder,
    private uploadService: UploadService,
    private alertService: AlertService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initForm();
    // Listen for profileType query param
    this.route.queryParams.subscribe(params => {
      const profileType = params['profileType'] || 'standard';
      this.highlightSection = profileType;
      this.cdr.detectChanges();
    });
    if (this.account) {
      console.log('[EditProfileComponent] Account data received:', this.account);
      this.patchForm();
      this.followers = this.account.followerImages || [];
      console.log('[EditProfileComponent] Followers loaded:', this.followers);
      this.cdr.detectChanges();
    }
  }

  ngAfterViewInit() {
    // No longer need to add event listeners manually as the directive handles it
  }

  // The wheel event handler is now in the directive

  ngOnChanges(changes: SimpleChanges) {
    if (changes['account'] && this.form) {
      console.log('[EditProfileComponent] Account data changed:', this.account);
      this.patchForm();
      this.followers = this.account?.followerImages || [];
      console.log('[EditProfileComponent] Followers updated:', this.followers);
      this.cdr.detectChanges();
    }
  }

  initForm() {
    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      city: [''],
      state: [''],
      zipCode: [''],
      phone: [''],
      mobile: [''],
      position: [''],
      company: [''],
      bio: [''],
      skills: [''],
      website: [''],
      twitter: [''],
      facebook: [''],
      instagram: [''],
      github: [''],
      linkedin: [''],
      followersCount: [0],
      followingCount: [0],
      profileTemplateType: [ProfileTemplateType.STANDARD]
    });
  }

  patchForm() {
    if (this.account) {
      this.form.patchValue({
        firstName: this.account.firstName,
        lastName: this.account.lastName,
        email: this.account.email,
        address: this.account.address,
        city: this.account.city,
        state: this.account.state,
        zipCode: this.account.zipCode,
        phone: this.account.phone,
        mobile: this.account.mobile,
        position: this.account.position,
        company: this.account.company,
        bio: this.account.bio,
        skills: this.account.skills,
        website: this.account.website,
        twitter: this.account.twitter,
        facebook: this.account.facebook,
        instagram: this.account.instagram,
        github: this.account.github,
        linkedin: this.account.linkedin,
        followersCount: this.account.followersCount,
        followingCount: this.account.followingCount,
        profileTemplateType: this.account.profileTemplateType || ProfileTemplateType.STANDARD
      });
      this.templateType = this.account.profileTemplateType || ProfileTemplateType.STANDARD;
      this.cdr.detectChanges();
    }
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }

    this.submitting = true;
    const formValue = this.form.value;
    formValue.followerImages = this.followers.map(f => {
      const { imageFile, ...rest } = f;
      return rest;
    });
    this.save.emit(formValue);
  }

  onCancel() {
    this.cancel.emit();
  }

  showField(fieldName: string): boolean {
    return this.templateType === ProfileTemplateType.SOCIAL_MEDIA;
  }

  isSocialMediaTemplate(): boolean {
    return this.templateType === ProfileTemplateType.SOCIAL_MEDIA;
  }

  onTemplateChange() {
    this.templateType = this.form.get('profileTemplateType')?.value || ProfileTemplateType.STANDARD;
  }

  // Follower methods
  openFollowerDialog(index?: number) {
    this.editingFollowerIndex = index !== undefined ? index : -1;
    if (index !== undefined) {
      this.currentFollower = { ...this.followers[index] };
    } else {
      this.currentFollower = { id: generateId(), name: '', title: '', imageUrl: '', path: '' };
    }
    this.showFollowerDialog = true;
  }

  closeFollowerDialog() {
    this.showFollowerDialog = false;
    this.editingFollowerIndex = -1;
    this.currentFollower = { name: '', title: '', imageUrl: '', path: '' };
  }

  async onFollowerImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.currentFollower.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
      // Store the file for later upload
      this.currentFollower.imageFile = file;
    }
  }

  async saveFollower(form: any) {
    if (form.invalid) {
      return;
    }

    if (!this.currentFollower.name) {
      this.alertService.error('Follower name is required');
      return;
    }

    // Ensure ID exists
    if (!this.currentFollower.id) {
      this.currentFollower.id = generateId();
    }

    try {
      // If we have an image file, upload it first
      if (this.currentFollower.imageFile) {
        const result = await this.uploadService.uploadFollowerImage(
          this.currentFollower.imageFile,
          this.currentFollower.name,
          this.currentFollower.title
        ).toPromise();

        if (result) {
          this.currentFollower.imageUrl = result.imageUrl;
          this.currentFollower.path = result.path;
        }
      }

      // Add or update the follower in the list
      if (this.editingFollowerIndex >= 0) {
        this.followers[this.editingFollowerIndex] = { ...this.currentFollower };
      } else {
        this.followers.push({ ...this.currentFollower });
      }

      // Reset the form
      this.currentFollower = { id: generateId(), name: '', title: '', imageUrl: '', path: '' };
      this.editingFollowerIndex = -1;
      this.showFollowerDialog = false;
    } catch (error) {
      this.alertService.error('Failed to save follower');
    }
  }

  editFollower(index: number) {
    this.openFollowerDialog(index);
  }

  removeFollower(index: number) {
    this.followers.splice(index, 1);
  }

  onImageChange(event: any): void {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    // Simulate conflict detection (replace with real logic as needed)
    if (this.account && this.account.profileImage) {
      this.imageConflict = true;
      this.imageConflictMessage = 'A profile image already exists. Overwrite the existing image?';
      this.selectedFile = file;
      this.pendingImage = URL.createObjectURL(file);
    } else {
      this.setProfileImage(file);
    }
  }

  confirmOverwrite(): void {
    if (this.selectedFile) {
      this.uploadProfileImage(this.selectedFile);
      this.imageConflict = false;
      this.imageConflictMessage = '';
      this.selectedFile = null;
      this.pendingImage = null;
    }
  }

  cancelOverwrite(): void {
    this.imageConflict = false;
    this.imageConflictMessage = '';
    this.selectedFile = null;
    this.pendingImage = null;
  }

  setProfileImage(file: File): void {
    this.uploadProfileImage(file);
  }

  private uploadProfileImage(file: File): void {
    if (!this.account || !this.account.id) {
      console.error('[EditProfile] No account or account ID for upload');
      return;
    }

    const profileName =
      (this.account?.firstName && this.account.firstName.trim()) ||
      (this.account?.email && this.account.email.trim()) ||
      'profile';

    const formData = new FormData();
    formData.append('profileImage', file);
    formData.append('userEmail', this.account.email || '');
    formData.append('profileName', profileName);

    this.accountService.uploadImage(this.account.id, formData)
      .pipe(first())
      .subscribe({
        next: (response) => {
          console.log('[EditProfile] Upload successful:', response);
          this.alertService.success('Profile image uploaded successfully');
          // Update the image in the account object so it displays immediately
          if (response.profileImage) {
            this.account!.profileImage = response.profileImage;
          }
          // Update the preview
          this.pendingImage = URL.createObjectURL(file);
        },
        error: (error) => {
          console.error('[EditProfile] Upload failed:', error);
          this.alertService.error(error);
        }
      });
  }

  onImageRemove(): void {
    // TODO: Implement image remove logic
    this.account && (this.account.profileImage = '');
    this.pendingImage = null;
  }
}

function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}
