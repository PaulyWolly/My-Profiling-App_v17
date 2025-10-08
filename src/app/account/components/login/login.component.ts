import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';
import { AuthService } from '@auth0/auth0-angular';

import { AlertService } from '@app/_services';
import { AccountService } from '@app/_services/account.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
    form!: FormGroup;
    loading = false;
    submitted = false;
    returnUrl: string = '/';

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        public auth: AuthService
    ) {
        // redirect to home if already logged in
        if (this.accountService.accountValue) {
            this.router.navigate(['/']);
        }
    }

    ngOnInit() {
        // Add login-page class to body for special styling
        document.body.classList.add('login-page');

        // Check if we're returning from Auth0 by looking for Auth0 callback parameters
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const code = urlParams.get('code') || hashParams.get('code');
        const state = urlParams.get('state') || hashParams.get('state');

        if (code && state) {
            // We're returning from Auth0, show loading message immediately
            this.loading = true;
        }

        // Check Auth0 authentication state to hide loading when fully logged in
        this.auth.isAuthenticated$.subscribe(isAuthenticated => {
            if (isAuthenticated) {
                // Add a small delay to ensure the user sees the loading message
                setTimeout(() => {
                    this.loading = false;
                }, 1000);
            }
        });

        // Check for stored rememberMe data to pre-fill email
        let savedEmail = '';
        try {
            const rememberedData = localStorage.getItem('rememberMe');
            if (rememberedData) {
                const data = JSON.parse(rememberedData);
                if (data && data.email) {
                    savedEmail = data.email;
                }
            }
        } catch (error) {
            console.error('Error reading remembered user:', error);
        }

        this.form = this.formBuilder.group({
            email: [savedEmail, [Validators.required, Validators.email]],
            password: ['', Validators.required],
            rememberMe: [!!savedEmail] // Pre-check if we loaded an email
        });

        // Watch for changes to the rememberMe checkbox
        this.form.get('rememberMe')?.valueChanges.subscribe(rememberMe => {
            if (!rememberMe) {
                // User unchecked "Remember my email" - clear stored data
                this.accountService.clearRememberedEmail();
            }
        });

        // get return url from route parameters or default to '/'
        this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    }

    ngOnDestroy() {
        // Remove login-page class when component is destroyed
        document.body.classList.remove('login-page');
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.form.invalid) {
            return;
        }

        this.loading = true;
        this.accountService.login(
            this.f.email.value,
            this.f.password.value,
            this.f.rememberMe.value // Pass the remember me checkbox value
        )
            .pipe(first())
            .subscribe({
                next: () => {
                    // Should navigate away or hide login form
                    this.router.navigate([this.returnUrl || '/']);
                    this.loading = false; // Hide spinner
                },
                error: error => {
                    this.alertService.error(error);
                    this.loading = false;
                }
            });
    }

    // Auth0 Google Login
    loginWithGoogle() {
        this.loading = false; // Don't show loading message on initial click

        this.auth.loginWithRedirect({
            authorizationParams: {
                connection: 'google-oauth2',
                redirect_uri: window.location.origin + '/profile'
            }
        });
    }

}
