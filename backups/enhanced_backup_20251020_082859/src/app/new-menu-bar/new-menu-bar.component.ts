import { Component, Input, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Role } from '../_models/role';
import { AccountService } from '../_services/account.service';
import { Auth0Service } from '../_services/auth0.service';

@Component({
  selector: 'app-new-menu-bar',
  templateUrl: './new-menu-bar.component.html',
  styleUrls: ['./new-menu-bar.component.css']
})
export class NewMenuBarComponent implements AfterViewInit {
  @Input() account: any;
  Role = Role;
  isDropdownOpen = false;
  currentUrl: string = '';
  dropdownOpen = false;

  constructor(private router: Router, private accountService: AccountService, private auth0Service: Auth0Service) {
    this.currentUrl = this.router.url;
    this.router.events.subscribe(() => {
      this.currentUrl = this.router.url;
    });
  }

  ngAfterViewInit() {
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
      dropdown.addEventListener('show.bs.dropdown', () => {
        this.dropdownOpen = true;
      });
      dropdown.addEventListener('hide.bs.dropdown', () => {
        this.dropdownOpen = false;
      });
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  isActiveRoute(route: string): boolean {
    return this.currentUrl === route;
  }

  isAccountSectionActive(): boolean {
    return (
      this.currentUrl.startsWith('/profile') ||
      this.currentUrl.startsWith('/profile-templates') ||
      this.currentUrl.startsWith('/account')
    );
  }

  logout() {
    console.log('[MenuBar] Starting logout process');
    // Run both logout methods for complete coverage
    this.accountService.logout();
    this.auth0Service.logoutFromAuth0();
  }
}
