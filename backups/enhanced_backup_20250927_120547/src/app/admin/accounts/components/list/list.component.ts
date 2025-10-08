import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { first, catchError } from 'rxjs/operators';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { NgIf } from '@angular/common';
import { of } from 'rxjs';

import { AccountService } from '@app/_services';
import { Router } from '@angular/router';
import { UserInterface } from '@app/types/user.interface';
import { Account } from '@app/_models';
import { environment } from '@environments/environment';

@Component({
  templateUrl: 'list.component.html',
  styleUrls: ['./list.component.css']
})
export class ListComponent implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['thumbnail', 'name', 'email', 'role', 'actions'];
    accounts: MatTableDataSource<Account>;
    user!: UserInterface;
    error: string = '';
    tempPasswords: { [key: string]: string } = {}; // Store temporary passwords

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    constructor(
      private accountService: AccountService,
      private route: Router
    ) {
      this.accounts = new MatTableDataSource<Account>();
      // Check if current user is Super-Admin
      this.user = this.accountService.accountValue || {} as UserInterface;
    }

    ngOnInit() {
      this.updateDisplayedColumns();
      this.loadAccounts();
    }

    private updateDisplayedColumns() {
      if (this.isSuperAdmin()) {
        // Insert password column after email and before role
        const emailIndex = this.displayedColumns.indexOf('email');
        this.displayedColumns.splice(emailIndex + 1, 0, 'password');
      }
    }

    ngAfterViewInit() {
        this.accounts.paginator = this.paginator;
        this.accounts.sort = this.sort;
    }

    loadAccounts() {
        this.accountService.getAll()
        .pipe(
          first(),
          catchError(err => {
            console.error('Error loading accounts:', err);
            this.error = 'Failed to load accounts. Please check your connection and try again.';
            return of([]);
          })
        )
        .subscribe(accounts => {
          accounts.forEach(account => {
            if (account.profileImage) {
              account.profileImage = this.getCompleteImageUrl(account.profileImage);
            }
          });
          this.accounts.data = accounts;
          if (this.paginator) {
            this.accounts.paginator = this.paginator;
          }
           if (this.sort) {
            this.accounts.sort = this.sort;
           }
        });
    }

    private getCompleteImageUrl(imageUrl: string): string {
        if (!imageUrl) return '';
        if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
          return imageUrl;
        }
        const apiUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl.slice(0, -1) : environment.apiUrl;
        const imagePath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
        return `${apiUrl}/${imagePath}`;
    }

    onDelete(id: any, firstName: string, lastName: string) {
      let userName = firstName + ' ' + lastName;
      let text = "Are you sure you want to DELETE user: " + userName + "?? \nOK or Cancel.";
      if (confirm(text) == true) {
        this.deleteAccount(id);
        this.route.navigate(['./admin/accounts']);
      } else {
        this.route.navigate(['./admin/accounts']);
      }
    }

    addAccount() {
      this.route.navigate(['/admin/accounts/add']);
    }

    deleteAccount(id: string) {
        const account = this.accounts.data.find(x => x.id === id);
        if (!account) return; // Exit if account not found

        const text = `Are you sure you want to delete the account for ${account.firstName} ${account.lastName} (${account.email})?\nOK or Cancel.`;
        if (confirm(text)) {
            account.isDeleting = true;
            this.accountService.delete(id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.accounts.data = this.accounts.data.filter(x => x.id !== id);
                    },
                    error: (err) => {
                        console.error('Delete failed:', err);
                        if (account) {
                            account.isDeleting = false;
                        }
                    }
                });
        } else {
            console.log('Delete cancelled by user.');
        }
    }

    // Super-Admin password reset functionality
    resetPassword(account: Account) {
        const newPassword = prompt(`Enter new password for ${account.firstName} ${account.lastName} (${account.email}):`);
        if (!newPassword) return;

        this.accountService.resetPasswordForSuperAdmin(account.id, newPassword)
            .pipe(first())
            .subscribe({
                next: (response) => {
                    // Store the temporary password for display
                    this.tempPasswords[account.id] = newPassword;
                    alert(`Password reset successfully!\nNew password: ${newPassword}`);
                },
                error: (err) => {
                    console.error('Password reset failed:', err);
                    alert('Failed to reset password. Please try again.');
                }
            });
    }

    // Check if current user is Super-Admin
    isSuperAdmin(): boolean {
        return this.user && this.user.role === 'Super-Admin';
    }

    // Check if current user can modify the target account
    canModifyAccount(targetAccount: Account): boolean {
        // Super-Admins can modify any account
        if (this.isSuperAdmin()) {
            return true;
        }

        // Non-Super-Admins cannot modify Super-Admin accounts
        if (targetAccount.role === 'Super-Admin') {
            return false;
        }

        // Non-Super-Admins can modify non-Super-Admin accounts
        return true;
    }

    // Check if current user can reset password for the target account
    canResetPassword(targetAccount: Account): boolean {
        // Super-Admins can reset any password
        if (this.isSuperAdmin()) {
            return true;
        }

        // Non-Super-Admins cannot reset Super-Admin passwords
        if (targetAccount.role === 'Super-Admin') {
            return false;
        }

        // Non-Super-Admins can reset non-Super-Admin passwords
        return true;
    }

    // Get display text for password status
    getPasswordDisplay(account: Account): string {
        // If we have a temporary password stored, show it
        if (this.tempPasswords[account.id]) {
            return this.tempPasswords[account.id];
        }

        // If we have the plain password from the database, show it
        if (account.plainPassword) {
            return account.plainPassword;
        }

        // Check if this is a legacy account (no plainPassword field)
        if (account.passwordStatus === 'Hashed' && !account.plainPassword) {
            return 'Legacy Account - Reset Required';
        }

        // Otherwise show the status
        return account.passwordStatus || 'Unknown';
    }

    // Show password for Super-Admin
    showPassword(account: Account) {
        this.accountService.getPasswordForSuperAdmin(account.id)
            .pipe(first())
            .subscribe({
                next: (response) => {
                    // Store the password for display
                    this.tempPasswords[account.id] = response.password;
                    alert(`Password for ${account.firstName} ${account.lastName}:\n${response.password}`);
                },
                error: (err) => {
                    console.error('Password retrieval failed:', err);
                    const errorMessage = err.error?.message || err.message || 'Failed to retrieve password';

                    if (errorMessage.includes('LEGACY_ACCOUNT')) {
                        const reset = confirm(`This account was created before password storage was implemented.\n\nWould you like to reset the password now to enable password visibility?`);
                        if (reset) {
                            this.resetPassword(account);
                        }
                    } else if (errorMessage.includes('Auth0')) {
                        alert('This is an Auth0/Google user - no password is stored locally.');
                    } else {
                        alert(`Failed to retrieve password: ${errorMessage}`);
                    }
                }
            });
    }
}

