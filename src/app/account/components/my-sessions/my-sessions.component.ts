import { Component, OnInit } from '@angular/core';
import { AccountService } from '@app/_services';

@Component({
    selector: 'app-my-sessions',
    templateUrl: './my-sessions.component.html',
    styleUrls: ['./my-sessions.component.scss']
})
export class MySessionsComponent implements OnInit {
    sessions: any[] = [];
    loading = false;
    error = '';

    // Pagination properties
    currentPage = 1;
    pageSize = 5;
    get totalPages() {
        return Math.ceil(this.sessions.length / this.pageSize) || 1;
    }
    get pagedSessions() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.sessions.slice(start, start + this.pageSize);
    }

    constructor(private accountService: AccountService) {
        console.log('[MySessionsComponent] Constructor called');
    }

    ngOnInit() {
        console.log('[MySessionsComponent] Initializing');
        this.loadSessions();
    }

    loadSessions() {
        console.log('[MySessionsComponent] Loading sessions');
        this.loading = true;
        this.error = '';
        
        this.accountService.getMySessions()
            .subscribe({
                next: (sessions) => {
                    console.log('[MySessionsComponent] Sessions loaded:', sessions);
                    this.sessions = sessions;
                    this.currentPage = 1; // Reset to first page on reload
                    this.loading = false;
                },
                error: (error) => {
                    console.error('[MySessionsComponent] Error loading sessions:', error);
                    this.error = error.error?.message || 'Failed to load sessions. Please try again later.';
                    this.loading = false;
                }
            });
    }

    revokeSession(sessionId: string) {
        console.log('[MySessionsComponent] Revoking session:', sessionId);
        this.accountService.revokeSession(sessionId)
            .subscribe({
                next: () => {
                    console.log('[MySessionsComponent] Session revoked successfully');
                    this.loadSessions();
                },
                error: (error) => {
                    console.error('[MySessionsComponent] Error revoking session:', error);
                    this.error = error.error?.message || 'Failed to revoke session. Please try again later.';
                }
            });
    }

    // Pagination navigation methods
    goToFirstPage() { this.currentPage = 1; }
    goToPrevPage() { if (this.currentPage > 1) this.currentPage--; }
    goToNextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
    goToLastPage() { this.currentPage = this.totalPages; }
} 