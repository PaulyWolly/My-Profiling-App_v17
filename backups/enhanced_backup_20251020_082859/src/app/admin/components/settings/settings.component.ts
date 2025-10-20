import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountService, SystemSettings } from '@app/_services';
import { first } from 'rxjs/operators';
import { TitleComponent } from '@app/shared/components/title/title.component';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule,
        TitleComponent
    ],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
    Math = Math;
    settings: SystemSettings = {
        activeSessionCount: 0,
        lastSessionCleanup: null,
        nextScheduledCleanup: null,
        cleanupSchedule: '0 0 * * *'
    };
    loading = false;
    historyLoading = false;
    cleanupHistory: any[] = [];
    currentPage = 1;
    pageSize = 2;
    totalRecords = 0;
    totalPages = 0;
    loadError: string | null = null;

    constructor(private accountService: AccountService) {}

    ngOnInit() {
        this.loadSettings();
        this.loadCleanupHistory();
    }

    loadSettings() {
        this.loading = true;
        this.loadError = null;
        this.accountService.getSettings()
            .pipe(first())
            .subscribe({
                next: (settings) => {
                    this.settings = settings;
                    this.loading = false;
                },
                error: error => {
                    console.error('Error loading settings:', error);
                    this.loadError = error?.message || 'Failed to load settings';
                    this.loading = false;
                }
            });
    }

    runCleanup() {
        this.loading = true;
        this.accountService.cleanupSessions()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.loadSettings();
                    this.loadCleanupHistory();
                    this.loading = false;
                },
                error: error => {
                    this.loadError = error;
                    this.loading = false;
                }
            });
    }

    loadCleanupHistory() {
        this.historyLoading = true;
        const params = {
            limit: this.pageSize.toString(),
            skip: ((this.currentPage - 1) * this.pageSize).toString()
        };
        
        this.accountService.getCleanupHistory(this.currentPage, this.pageSize)
            .pipe(first())
            .subscribe({
                next: (response) => {
                    this.cleanupHistory = response.history || [];
                    if (response.pagination) {
                        this.totalRecords = response.pagination.total;
                        this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
                        if (this.currentPage > this.totalPages && this.totalPages > 0) {
                            this.currentPage = this.totalPages;
                        }
                        if (this.totalRecords > 0 && this.currentPage < 1) {
                            this.currentPage = 1;
                        }
                    } else {
                        this.totalRecords = this.cleanupHistory.length;
                        this.totalPages = 1;
                        this.currentPage = 1;
                    }
                    this.historyLoading = false;
                },
                error: (error) => {
                    console.error('Error loading cleanup history:', error);
                    this.loadError = error?.message || 'Failed to load cleanup history';
                    this.historyLoading = false;
                }
            });
    }

    deleteRecord(id: string) {
        if (confirm('Are you sure you want to delete this record?')) {
            this.historyLoading = true;
            this.accountService.deleteCleanupRecord(id)
                .subscribe({
                    next: () => {
                        this.loadCleanupHistory();
                    },
                    error: (error) => {
                        console.error('Error deleting record:', error);
                        this.historyLoading = false;
                    }
                });
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadCleanupHistory();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadCleanupHistory();
        }
    }

    goToFirstPage() {
        if (this.currentPage > 1) {
            this.currentPage = 1;
            this.loadCleanupHistory();
        }
    }

    goToLastPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage = this.totalPages;
            this.loadCleanupHistory();
        }
    }
} 