import { Injectable, Inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AccountService } from '@app/_services/account.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(AccountService) private accountService: AccountService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const user = this.accountService.accountValue;
    if (user && (user.role === 'Admin' || user.role === 'Super-Admin')) {
      return true;
    }

    // Not logged in or not an admin, redirect to home
    this.router.navigate(['/']);
    return false;
  }
}
