import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AccountService } from '@app/_services/account.service';
import { AlertService } from '@app/_services';
import { TitleComponent } from '@app/shared/components/title/title.component';
import { Account } from '@app/_models';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '@environments/environment';

@Component({
    selector: 'app-monitor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TitleComponent
    ],
    templateUrl: './monitor.component.html',
    styleUrls: ['./monitor.component.css']
})
export class MonitorComponent implements OnInit, OnDestroy {
    activeSessions: any[] = [];
    loading = false;
    error: string | null = null;
    selectedSessions = new Set<string>();
    currentAccountId: string | null = null;
    private pollingSubscription?: Subscription;

    // Pagination state
    currentPage = 1;
    pageSize = 5; // Set default page size to 5
    totalSessions = 0;
    totalPages = 0;

    constructor(
        private accountService: AccountService,
        private http: HttpClient,
        private alertService: AlertService
    ) {}

    ngOnInit(): void {
        this.accountService.account.subscribe(account => {
            this.currentAccountId = account?.id || null;
        });
        this.loadSessions(); // Initial load for page 1
    }

    ngOnDestroy(): void {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
        }
    }

    loadSessions(): void {
        this.loading = true;
        this.error = null;
        // Add page and pageSize query parameters
        const params = {
            page: this.currentPage.toString(),
            pageSize: this.pageSize.toString()
        };

        this.http.get<any>(`${environment.apiUrl}/accounts/active-sessions`, { params })
            .subscribe({
                next: (response) => {
                    // Handle the structured response
                    this.activeSessions = response.sessions || [];
                    if (response.pagination) {
                        this.totalSessions = response.pagination.totalSessions;
                        this.totalPages = response.pagination.totalPages;
                        this.currentPage = response.pagination.currentPage; // Ensure current page is synced
                        this.pageSize = response.pagination.pageSize;
                    } else {
                        // Fallback if pagination object is missing (shouldn't happen)
                        this.totalSessions = this.activeSessions.length;
                        this.totalPages = 1;
                        this.currentPage = 1;
                    }
                    this.loading = false;
                    this.selectedSessions.clear(); // Clear selection on page change
                },
                error: (err: HttpErrorResponse) => {
                    this.error = `Failed to load sessions: ${err.message}`;
                    console.error(err);
                    this.loading = false;
                    this.alertService.error(this.error);
                }
            });
    }

    refresh(): void {
        this.currentPage = 1; // Reset to page 1 on refresh
        this.loadSessions();
    }

    // Pagination methods
    previousPage(): void {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadSessions();
        }
    }

    nextPage(): void {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadSessions();
        }
    }

    toggleSelectAll(event?: Event): void {
        const checkbox = event?.target as HTMLInputElement;
        if (checkbox?.checked) {
            this.activeSessions.forEach(session => {
                if (!this.isCurrentUserSession(session.id)) {
                    this.selectedSessions.add(session.id);
                }
            });
        } else {
            this.selectedSessions.clear();
        }
    }

    onSessionSelect(event: Event, sessionId: string): void {
        const checkbox = event.target as HTMLInputElement;
        if (checkbox.checked) {
            this.selectedSessions.add(sessionId);
        } else {
            this.selectedSessions.delete(sessionId);
        }
    }

    deleteSelected(): void {
        const idsToDelete = Array.from(this.selectedSessions);
        if (idsToDelete.length === 0) return;

        this.loading = true;
        this.http.post(`${environment.apiUrl}/accounts/sessions/delete-batch`, { ids: idsToDelete })
            .subscribe({
                next: () => {
                    this.alertService.success('Selected sessions deleted successfully.');
                    this.selectedSessions.clear();

                    // If we just deleted all items on the current page and there are more pages, go to the previous page
                    if (idsToDelete.length === this.activeSessions.length && this.currentPage > 1) {
                        this.currentPage--;
                    }
                    this.loadSessions();
                    this.loading = false;
                },
                error: (err: HttpErrorResponse) => {
                    this.alertService.error(`Failed to delete sessions: ${err.message}`);
                    console.error(err);
                    this.loading = false;
                }
            });
    }

    isCurrentUserSession(sessionId: string): boolean {
        const currentSessionId = sessionStorage.getItem('sessionId');
        return sessionId === currentSessionId || this.activeSessions.find(s => s.id === sessionId && s.accountId === this.currentAccountId) != null;
    }

    forceLogout(sessionId: string): void {
        this.loading = true;
        this.http.post(`${environment.apiUrl}/accounts/sessions/${sessionId}/force-logout`, {})
            .subscribe({
                next: () => {
                    this.alertService.success('Session logged out successfully.');
                    this.loadSessions();
                    this.loading = false;
                },
                error: (err: HttpErrorResponse) => {
                    this.alertService.error(`Failed to force logout: ${err.message}`);
                    console.error(err);
                    this.loading = false;
                }
            });
    }

    cleanupTokens(): void {
        this.loading = true;
        this.error = null;
        this.http.post(`${environment.apiUrl}/sessions/cleanup-tokens`, {})
            .subscribe({
                next: (response: any) => {
                    this.alertService.success(`Token cleanup successful: ${response.message}`);
                    this.loadSessions();
                    this.loading = false;
                },
                error: (err: HttpErrorResponse) => {
                    this.error = `Failed to cleanup tokens: ${err.message}`;
                    console.error(err);
                    this.loading = false;
                    this.alertService.error(this.error);
                }
            });
    }

    cleanupAllSessions(): void {
        if (!confirm('Are you sure you want to clean up ALL expired/invalid sessions? This cannot be undone.')) {
            return;
        }
        this.loading = true;
        this.error = null;
        this.http.post(`${environment.apiUrl}/sessions/cleanup-all`, {})
            .subscribe({
                next: (response: any) => {
                    this.alertService.success(`Cleanup successful: ${response.message}`);
                    this.loadSessions();
                    this.selectedSessions.clear();
                    this.loading = false;
                },
                error: (err: HttpErrorResponse) => {
                    this.error = `Failed to cleanup sessions: ${err.message}`;
                    console.error(err);
                    this.loading = false;
                    this.alertService.error(this.error);
                }
            });
    }
}
