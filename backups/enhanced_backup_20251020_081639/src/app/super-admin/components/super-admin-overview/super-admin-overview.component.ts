import { Component } from '@angular/core';

@Component({
  selector: 'app-super-admin-overview',
  standalone: true,
  template: `
    <div class="super-admin-overview">
      <h2>Super-Admin Overview</h2>
      <p>Welcome to the Super-Admin dashboard. Here you can manage system-wide settings, logs, and more.</p>
    </div>
  `,
  styles: [`
    .super-admin-overview {
      padding: 2rem;
      text-align: center;
    }
    .super-admin-overview h2 {
      color: #2563eb;
      margin-bottom: 1rem;
    }
  `]
})
export class SuperAdminOverviewComponent {}
