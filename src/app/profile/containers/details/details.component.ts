import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { AccountService, ProfileTemplateService } from '@app/_services';
import { Account } from '@app/_models';
import { ProfileTemplateType } from '@app/_models/profile-template';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css']
})
export class DetailsComponent implements OnInit, OnDestroy {
  // Expose enum to template
  ProfileTemplateType = ProfileTemplateType;

  account: Account | null = null;
  currentTemplate: ProfileTemplateType = ProfileTemplateType.STANDARD;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private accountService: AccountService,
    private profileTemplateService: ProfileTemplateService
  ) {
    console.log('DetailsComponent constructor called');
  }

  ngOnInit() {
    console.log('DetailsComponent ngOnInit called');

    // Subscribe to account changes
    const accountSub = this.accountService.account$.subscribe(x => {
      console.log('DetailsComponent - Account updated:', x);
      this.account = x;
    });
    this.subscriptions.add(accountSub);

    // Subscribe to template changes
    const templateSub = this.profileTemplateService.currentTemplate.subscribe(template => {
      console.log('DetailsComponent - Template changed to:', template);
      this.currentTemplate = template;
    });
    this.subscriptions.add(templateSub);

    // Log initial template value from service
    console.log('Initial template value:', this.profileTemplateService.currentTemplateValue);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.unsubscribe();
  }

  // Add this method to refresh the account after saving in Edit Profile
  public refreshAccount() {
    const id = this.accountService.accountValue?.id;
    if (id) {
      this.accountService.getById(id).subscribe(account => {
        this.account = account;
      });
    }
  }
}
