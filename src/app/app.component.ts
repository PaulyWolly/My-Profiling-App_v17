import { Component, OnInit, HostListener, Renderer2, ViewEncapsulation, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AccountService, Auth0Service } from '@app/_services';
import { Subscription } from 'rxjs';
import { Account, Role } from './_models';

declare var bootstrap: any;

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['./app.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
    Role = Role;
    account?: Account | null;
    currentUrl: string = '';
    isDropdownOpen = false;
    private initialNavigation = true;
    private subscriptions: Subscription = new Subscription();

    constructor(
        private accountService: AccountService,
        private auth0Service: Auth0Service,
        private router: Router,
        private renderer: Renderer2
    ) {
        // Use Angular Signals with effect() for reactive account state changes
        effect(() => {
            const x = this.accountService.account();
            this.account = x;

            // Get the current URL
            const currentUrl = window.location.pathname || '/';
            console.log('[AppComponent] Account state changed. Current URL:', currentUrl);

            // Only redirect on initial navigation and only if we're on root path
            if (this.initialNavigation) {
                this.initialNavigation = false;

                // Only redirect if we're on the root path - ALL users go to profile
                if (currentUrl === '/' || currentUrl === '') {
                    console.log('[AppComponent] Redirecting to profile page for role:', x?.role);
                    this.router.navigate(['/profile']);
                }
                // Otherwise stay on current page if it's a valid route
                else if (currentUrl && currentUrl !== '/' && !currentUrl.includes('/account/')) {
                    console.log('[AppComponent] Staying on current page after authentication:', currentUrl);
                }
            }
        });

        // Track navigation for active link highlighting and page-specific handling
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd)
        ).subscribe(event => {
            this.currentUrl = event.url;
            console.log('[AppComponent] Navigation to:', this.currentUrl);

            // Handle account pages scrolling and classes
            this.handleAccountPagesScrolling(this.currentUrl);
        });
    }

    // Handle specific pages that need special scroll handling
    private handleAccountPagesScrolling(url: string) {
        const isAccountPage = url.includes('/account/') ||
                             url.includes('/login') ||
                             url.includes('/register') ||
                             url.includes('/forgot-password') ||
                             url.includes('/reset-password');

        if (isAccountPage) {
            // Add classes for account pages
            this.renderer.addClass(document.documentElement, 'no-scroll');
            this.renderer.addClass(document.body, 'no-scroll');
            this.renderer.addClass(document.body, 'account-page');
            this.renderer.addClass(document.body, 'login-page');
            this.renderer.addClass(document.documentElement, 'login-page');
        } else {
            // Remove classes when not on account pages
            this.renderer.removeClass(document.documentElement, 'no-scroll');
            this.renderer.removeClass(document.body, 'no-scroll');
            this.renderer.removeClass(document.body, 'account-page');
            this.renderer.removeClass(document.body, 'login-page');
            this.renderer.removeClass(document.documentElement, 'login-page');
        }
    }

    // Global wheel event listener to prevent body scrolling except in specific places
    @HostListener('wheel', ['$event'])
    onWheel(event: WheelEvent) {
        let el = event.target as HTMLElement | null;

        // Traverse up the DOM tree to find a scrollable ancestor
        while (el) {
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            const isScrollable = (overflowY === 'auto' || overflowY === 'scroll');
            const canScroll = el.scrollHeight > el.clientHeight;

            if (isScrollable && canScroll) {
                // Allow scrolling in this container
                return;
            }
            el = el.parentElement;
        }

        // If no scrollable ancestor found, prevent scrolling
        event.preventDefault();
        event.stopPropagation();
    }

    ngOnInit() {
        // Initialize Auth0 service
        this.auth0Service.isAuthenticatedWithAuth0().subscribe(isAuthenticated => {
            if (isAuthenticated) {
                console.log('[AppComponent] User is authenticated with Auth0');
            }
        });
    }

    ngOnDestroy() {
        // Clean up subscriptions
        this.subscriptions.unsubscribe();

        // Remove any remaining classes
        this.renderer.removeClass(document.documentElement, 'no-scroll');
        this.renderer.removeClass(document.body, 'no-scroll');
        this.renderer.removeClass(document.body, 'account-page');
    }

    logout() {
        this.accountService.logout();
    }

    // Force navigation to a URL to overcome potential router issues
    navigateTo(route: string): void {
        console.log(`Forcing navigation to ${route}`);

        // If we're already on this route's page, don't navigate again
        if (this.isActiveRoute(route)) {
            console.log('Already on this route, not navigating');
            return;
        }

        // Force navigation by first going to root (skipLocationChange means URL doesn't change in browser)
        this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
            // Then navigate to the intended route
            this.router.navigateByUrl(route);
        });
    }

    // Improved active route detection with path-based logic
    isActiveRoute(route: string): boolean {
        // Home is active only when URL is exactly '/'
        if (route === '/' && this.currentUrl === '/') {
            return true;
        }

        // For non-home routes, check if the URL starts with the route path
        // but make sure we're not matching partial paths (e.g. '/profile' shouldn't match '/prof')
        if (route !== '/') {
            // Admin routes should highlight Admin link
            if (route === '/admin' && this.currentUrl.startsWith('/admin')) {
                return true;
            }

            // Profile routes should highlight Profile link
            if (route === '/profile' && this.currentUrl.startsWith('/profile')) {
                // Don't highlight profile for account settings
                if (this.currentUrl.includes('/profile/account-settings') && route === '/profile') {
                    return false;
                }
                return true;
            }

            // Account settings route
            if (route === '/profile/account-settings' && this.currentUrl.includes('/profile/account-settings')) {
                return true;
            }
        }

        return false;
    }

    ngAfterViewInit() {
        // Initialize all dropdowns
        this.initializeDropdowns();

        // Re-initialize dropdowns after route changes
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd)
        ).subscribe(() => {
            setTimeout(() => {
                this.initializeDropdowns();
            }, 100);
        });
    }

    // Initialize Bootstrap dropdowns
    private initializeDropdowns() {
        try {
            // Check if bootstrap is available
            if (typeof bootstrap !== 'undefined') {
                // Get all dropdown elements and initialize them
                const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
                const dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
                    return new bootstrap.Dropdown(dropdownToggleEl, {
                        // Ensure it only opens on click, not hover
                        hover: false,
                        // Prevent auto close when clicking inside the dropdown
                        autoClose: 'outside'
                    });
                });

                // Add click handlers to ensure dropdown links work properly
                document.querySelectorAll('.dropdown-menu a.dropdown-item').forEach(item => {
                    item.addEventListener('click', function() {
                        // Close any open dropdowns when clicking a dropdown item
                        const openDropdowns = document.querySelectorAll('.dropdown-menu.show');
                        openDropdowns.forEach(dropdown => {
                            bootstrap.Dropdown.getInstance(
                                dropdown.previousElementSibling
                            )?.hide();
                        });
                    });
                });

                console.log('Dropdowns initialized with click behavior');
            }
        } catch (error) {
            console.error('Error initializing dropdowns:', error);
        }
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    closeDropdown() {
        this.isDropdownOpen = false;
    }

    isAdminSectionActive(): boolean {
        return this.router.url.startsWith('/admin') || this.router.url.startsWith('/super-admin');
    }

    getSubnavType(): 'admin' | 'super-admin' | null {
        if (this.router.url.startsWith('/admin')) {
            return 'admin';
        }
        if (this.router.url.startsWith('/super-admin')) {
            return 'super-admin';
        }
        return null;
    }
}
