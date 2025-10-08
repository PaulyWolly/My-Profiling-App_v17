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
        // Check if token is valid before redirecting
        if (this.accountService.accountValue) {
            this.accountService.refreshToken()
                .pipe(first())
                .subscribe({
                    next: () => {
                        // No redirect here; stay on the current page
                    },
                    error: () => {
                        // If token refresh fails, user should stay on login page
                        this.accountService.logout();
                    }
                });
        }
    }
}
