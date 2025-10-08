import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, ActivatedRoute } from '@angular/router';
import { ProfileTemplateService, AccountService } from '@app/_services';
import { ProfileTemplateType } from '@app/_models/profile-template';
import { TitleComponent } from '@app/shared/components/title/title.component';
import { Account } from '@app/_models';
import { first } from 'rxjs/operators';
import { CurvedBorderComponent } from '@app/shared/curved-border/curved-border.component';

@Component({
    selector: 'app-new-standard-preview',
    templateUrl: './new-standard-preview.component.html',
    styleUrls: ['./new-standard-preview.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatProgressSpinnerModule,
        TitleComponent,
        CurvedBorderComponent
    ]
})
export class NewStandardPreviewComponent implements OnInit {
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
        // Use Signals instead of Observable subscription
        const account = this.accountService.account();
        if (account) {
            this.profile = account;
            this.error = '';
        } else {
            this.error = 'Profile not found';
        }
        this.loading = false;
    }

    useTemplate(): void {
        this.loading = true;
        const currentUser = this.accountService.accountValue;

        if (currentUser?.id) {
            // Update the profile with the new template type
            this.accountService.update(currentUser.id, {
                profileTemplateType: ProfileTemplateType.STANDARD
            })
            .pipe(first())
            .subscribe({
                next: () => {
                    // After successful update, set the template and navigate
                    this.profileTemplateService.setTemplate(ProfileTemplateType.STANDARD, true);
                    this.router.navigate(['/profile'], {
                        queryParams: { template: 'standard' }
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
            this.profileTemplateService.setTemplate(ProfileTemplateType.STANDARD);
            this.router.navigate(['/profile'], {
                queryParams: { template: 'standard' }
            });
        }
    }

    previewTemplate(): void {
        this.profileTemplateService.setTemplate(ProfileTemplateType.STANDARD);
        this.router.navigate(['/profile'], {
            queryParams: { template: 'standard', preview: 'true' }
        });
    }
}
