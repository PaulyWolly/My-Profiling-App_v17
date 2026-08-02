import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthService } from '@auth0/auth0-angular';

import { AlertService } from '@app/_services';
import { AccountService } from '@app/_services/account.service';
import { environment } from '@environments/environment';

/** Set when the user clicks Continue with Google; cleared on app session or logout. */
const GOOGLE_SIGNIN_PENDING = 'google_signin_pending';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
    form!: FormGroup;
    loading = false;
    /**
     * Only true during an intentional Google sign-in handoff (~2s after Auth0).
     * Not shown on logout, and not merely because Auth0 still has a session.
     */
    completingGoogleSignIn = false;
    submitted = false;
    returnUrl: string = '/';
    private subs = new Subscription();

    get isGoogleLoginEnabled(): boolean {
        const d = environment.auth0?.domain?.trim();
        const c = environment.auth0?.clientId?.trim();
        return !!(d && c);
    }

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        public auth: AuthService
    ) {
        if (this.accountService.accountValue) {
            this.router.navigate(['/']);
        }
    }

    ngOnInit() {
        document.body.classList.add('login-page');
        this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

        const pendingGoogle = sessionStorage.getItem(GOOGLE_SIGNIN_PENDING) === '1';
        const loggingOut = sessionStorage.getItem('auth_logging_out') === '1';

        // Logout lands here — always show the normal form, never the handoff.
        if (loggingOut) {
            sessionStorage.removeItem(GOOGLE_SIGNIN_PENDING);
            sessionStorage.removeItem('auth_logging_out');
            this.completingGoogleSignIn = false;
        } else if (pendingGoogle) {
            // Intentional Google return — keep the handoff card up until we leave
            // this page. Do not flip back to the form when the JWT lands a tick
            // before navigation (that was the 1-second form flash).
            this.completingGoogleSignIn = true;
            this.subs.add(
                this.auth.isAuthenticated$.subscribe((isAuthenticated) => {
                    if (isAuthenticated && !this.accountService.accountValue) {
                        this.completingGoogleSignIn = true;
                    }
                })
            );
        } else {
            this.completingGoogleSignIn = false;
        }

        let savedEmail = '';
        try {
            const rememberedData = localStorage.getItem('rememberMe');
            if (rememberedData) {
                const data = JSON.parse(rememberedData);
                if (data?.email) {
                    savedEmail = data.email;
                }
            }
        } catch (error) {
            console.error('Error reading remembered user:', error);
        }

        this.form = this.formBuilder.group({
            email: [savedEmail, [Validators.required, Validators.email]],
            password: ['', Validators.required],
            rememberMe: [!!savedEmail]
        });

        this.form.get('rememberMe')?.valueChanges.subscribe((rememberMe) => {
            if (!rememberMe) {
                this.accountService.clearRememberedEmail();
            }
        });
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
        document.body.classList.remove('login-page');
    }

    get f() {
        return this.form.controls;
    }

    onSubmit() {
        this.submitted = true;
        this.alertService.clear();

        if (this.form.invalid) {
            return;
        }

        this.loading = true;
        this.accountService
            .login(this.f.email.value, this.f.password.value, this.f.rememberMe.value)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.router.navigate([this.returnUrl || '/']);
                    this.loading = false;
                },
                error: (error) => {
                    this.alertService.error(error);
                    this.loading = false;
                }
            });
    }

    loginWithGoogle() {
        if (!this.isGoogleLoginEnabled) {
            this.alertService.warn(
                'Google sign-in is not configured for this environment. Use email and password, or set Auth0 domain and clientId.'
            );
            return;
        }
        // Mark intent only — keep the login form until Auth0 returns.
        sessionStorage.setItem(GOOGLE_SIGNIN_PENDING, '1');
        sessionStorage.removeItem('auth_logging_out');
        this.auth.loginWithRedirect({
            authorizationParams: {
                connection: 'google-oauth2',
                prompt: 'select_account',
                redirect_uri: window.location.origin + '/profile'
            }
        });
    }
}
