import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { AccountService } from '@app/_services/account.service';

export const superAdminGuard: CanActivateFn & CanActivateChildFn = (route, state) => {
  const accountService = inject(AccountService);
  const router = inject(Router);
  const user = accountService.accountValue;

  if (user && user.role === 'Super-Admin') {
    return true;
  }
  return router.createUrlTree(['/']);
};
