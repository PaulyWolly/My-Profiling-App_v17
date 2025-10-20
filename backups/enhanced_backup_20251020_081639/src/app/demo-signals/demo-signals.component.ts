import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountService } from '@app/_services/account.service';
import { Account } from '@app/_models';

@Component({
  selector: 'app-demo-signals',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <h2>Angular Signals Demo</h2>

      <!-- Account Information -->
      <div class="account-info">
        <h3>Account State (Signals)</h3>
        <p><strong>Is Authenticated:</strong> {{ accountService.isAuthenticated() }}</p>
        <p><strong>Is Loading:</strong> {{ accountService.isLoading() }}</p>
        <p><strong>Is Admin:</strong> {{ accountService.isAdmin() }}</p>
        <p><strong>Is Super Admin:</strong> {{ accountService.isSuperAdmin() }}</p>

        <div *ngIf="accountService.account() as account">
          <h4>Account Details:</h4>
          <p><strong>Name:</strong> {{ account.firstName }} {{ account.lastName }}</p>
          <p><strong>Email:</strong> {{ account.email }}</p>
          <p><strong>Role:</strong> {{ account.role }}</p>
        </div>

        <div *ngIf="accountService.error() as error">
          <p class="error"><strong>Error:</strong> {{ error }}</p>
        </div>
      </div>

      <!-- Legacy Observable (for comparison) -->
      <div class="legacy-info">
        <h3>Legacy Observable (for comparison)</h3>
        <p><strong>Account Value:</strong> {{ accountService.accountValue?.firstName || 'Not logged in' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .account-info, .legacy-info {
      background: #f5f5f5;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
    }

    .error {
      color: red;
      font-weight: bold;
    }

    h2, h3, h4 {
      color: #333;
    }
  `]
})
export class DemoSignalsComponent implements OnInit {

  constructor(public accountService: AccountService) {}

  ngOnInit() {
    console.log('Demo Signals Component initialized');
    console.log('Current account state:', this.accountService.account());
    console.log('Is authenticated:', this.accountService.isAuthenticated());
  }
}
