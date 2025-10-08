import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, ActivatedRoute } from '@angular/router';
import { ProfileTemplateService, AccountService } from '@app/_services';
import { ProfileTemplateType } from '@app/_models/profile-template';
// import { TitleComponent } from '@app/shared/components/title/title.component';
import { Account } from '@app/_models';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-new-social-media-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
    // ,
    // TitleComponent
  ],
  // template: `
  templateUrl: './new-social-media-preview.component.html',
  //   <div class="new-social-media-container">
  //     <!-- Loading State -->
  //     <div *ngIf="loading" class="loading-container">
  //       <mat-spinner diameter="40"></mat-spinner>
  //       <p>Loading profile...</p>
  //     </div>

  //     <!-- Error State -->
  //     <div *ngIf="error" class="alert alert-danger">
  //       {{ error }}
  //     </div>

  //     <!-- Main Content -->
  //     <div *ngIf="!loading && !error">
  //       <div class="d-flex justify-content-between align-items-center mb-4">
  //         <app-title [text]="'Social Media Template'" [level]="1" [marginBottom]="'none'"></app-title>
  //         <div>
  //           <button mat-raised-button color="primary" (click)="useTemplate()" class="me-2">
  //             <mat-icon>check_circle</mat-icon>
  //             Use This Template
  //           </button>
  //           <button mat-button color="accent" (click)="previewTemplate()">
  //             <mat-icon>preview</mat-icon>
  //             Live Preview
  //           </button>
  //         </div>
  //       </div>

  //       <div class="template-preview">
  //         <mat-card class="preview-card">
  //           <div class="preview-flex-row">
  //             <img src="assets/images/profile-templates/social-media-template.png" 
  //                  alt="Social Media Template Preview" 
  //                  class="preview-image" />
  //             <div class="preview-description">
  //               <p>
  //                 This is our new social media template, featuring a modern, social-inspired layout for your professional profile.
  //               </p>
  //               <div class="features-list">
  //                 <h3>Features:</h3>
  //                 <ul>
  //                   <li>Large profile image and header</li>
  //                   <li>Followers and following counts</li>
  //                   <li>Social links and contact info</li>
  //                   <li>Followers you know preview</li>
  //                   <li>Modern, card-based design</li>
  //                 </ul>
  //               </div>
  //             </div>
  //           </div>
  //         </mat-card>
  //       </div>
  //     </div>
  //   </div>
  // `,
  styleUrls: ['./new-social-media-preview.component.scss']
})
export class NewSocialMediaPreviewComponent implements OnInit {
  loading = true;
  error = '';
  profile?: Account;
  isPreview = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private profileTemplateService: ProfileTemplateService,
    private accountService: AccountService
  ) {
    // Check if we're in preview mode
    this.route.queryParams.subscribe(params => {
      this.isPreview = params['preview'] === 'true';
    });
  }

  ngOnInit() {
    this.loadProfile();
  }

  private loadProfile() {
    this.loading = true;
    this.accountService.account.subscribe({
      next: (account) => {
        if (account) {
          this.profile = account;
          this.error = '';
        } else {
          this.error = 'Profile not found';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.error = 'Error loading profile';
        this.loading = false;
      }
    });
  }

  useTemplate(): void {
    this.loading = true;
    const currentUser = this.accountService.accountValue;
    
    if (currentUser?.id) {
      // Update the profile with the new template type
      this.accountService.update(currentUser.id, { 
        profileTemplateType: ProfileTemplateType.SOCIAL_MEDIA 
      })
      .pipe(first())
      .subscribe({
        next: () => {
          // After successful update, set the template and navigate
          this.profileTemplateService.setTemplate(ProfileTemplateType.SOCIAL_MEDIA, true);
          this.router.navigate(['/profile'], { 
            queryParams: { template: 'social-media' }
          });
        },
        error: (error) => {
          console.error('Error updating template:', error);
          this.error = 'Failed to update template';
          this.loading = false;
        }
      });
    } else {
      // If no user ID, just set the template and navigate
      this.profileTemplateService.setTemplate(ProfileTemplateType.SOCIAL_MEDIA);
      this.router.navigate(['/profile'], { 
        queryParams: { template: 'social-media' }
      });
    }
  }

  previewTemplate(): void {
    this.profileTemplateService.setTemplate(ProfileTemplateType.SOCIAL_MEDIA);
    this.router.navigate(['/profile'], { 
      queryParams: { template: 'social-media', preview: 'true' }
    });
  }
}