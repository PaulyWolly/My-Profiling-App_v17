import { Component, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Account } from '@app/_models';
import { AccountService, AlertService } from '@app/_services';
import { first } from 'rxjs/operators';
import { ProfileTemplateType } from '@app/_models/profile-template';
import { CustomTooltipDirective } from '@app/shared/custom-tooltip/custom-tooltip.directive';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  account: Account | null = null;
  profileUser: Account | null = null;
  currentTemplate = ProfileTemplateType.STANDARD;
  ProfileTemplateType = ProfileTemplateType;
  loading = false;
  isOwnProfile = true;
  isEditingTemplate = false;
  userId: string = '';

  // Chat dock properties
  showChatList = false;
  onlineUsersCount = 0;

  constructor(
    private accountService: AccountService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: AlertService
  ) {
    // Use Angular Signals with effect() for reactive account state changes
    effect(() => {
      const account = this.accountService.account();
      this.account = account;
      // Load the profile data
      this.loadUserProfile();
    });
  }

  ngOnInit() {
    // Subscribe to route changes
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.userId = params['id'];
        this.loadUserProfile();
      }
    });
  }

  /**
   * Load the profile data for the specified user
   */
  private loadUserProfile() {
    if (!this.account) {
      return; // Can't proceed without a logged-in account
    }

    this.loading = true;
    this.userId = this.userId || this.route.snapshot.params['id'] || this.account?.id;

    // If viewing own profile
    this.isOwnProfile = this.userId === this.account?.id;

    if (this.isOwnProfile) {
      // If it's their own profile, use the account data
      this.profileUser = this.account;
      this.currentTemplate = this.account.profileTemplateType || ProfileTemplateType.STANDARD;
      this.loading = false;
      console.log('[ProfileComponent] Loaded own profile');
    } else {
      // If viewing someone else's profile, load it
      this.accountService.getById(this.userId)
        .pipe(first())
        .subscribe({
          next: (user) => {
            this.profileUser = user;

            // Use the profile user's template if available, otherwise use default
            this.currentTemplate = user.profileTemplateType || ProfileTemplateType.STANDARD;
            console.log('[ProfileComponent] Loaded other user profile');

            this.loading = false;
          },
          error: (error: string) => {
            this.alertService.error('Error loading profile: ' + error);
            this.loading = false;
          }
        });
    }
  }

  isTemplateActive(template: string): boolean {
    return this.currentTemplate === template;
  }

  selectTemplate(template: string) {
    this.currentTemplate = template as ProfileTemplateType;
  }

  toggleTemplateEditor() {
    this.isEditingTemplate = !this.isEditingTemplate;
  }

  toggleChatList() {
    this.showChatList = !this.showChatList;
  }
}
