import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AccountService } from '@app/_services/account.service';

@Component({
    templateUrl: 'layout.component.html',
    styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {
    constructor(
        private router: Router,
        private accountService: AccountService
    ) {}

    ngOnInit() {
        const url = this.router.url;
        const isLoginRoute = url.includes('/login') || url.endsWith('/account') || url.endsWith('/account/');
        // Only run refresh check when we're on a protected account route (e.g. sessions), not on login
        if (isLoginRoute) return;
        if (this.accountService.accountValue) {
            this.accountService.refreshToken()
                .pipe(first())
                .subscribe({
                    next: () => {},
                    error: () => {
                        this.accountService.logout();
                    }
                });
        }
    }
}
