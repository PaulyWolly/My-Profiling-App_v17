import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitleComponent } from '@app/shared/components/title/title.component';
import { MatDialog } from '@angular/material/dialog';
import { LogOutputViewComponent } from './log-output-view.component';
import { AccountService } from '@app/_services/account.service';

interface LogEntry {
  id: string;
  type: 'User' | 'System' | 'Error' | 'Audit';
  timestamp: Date;
  user?: string;
  action: string;
  status: 'Success' | 'Warning' | 'Error' | 'Info';
  message: string;
  ipAddress?: string;
}

@Component({
  selector: 'app-super-admin-logs',
  standalone: true,
  imports: [CommonModule, TitleComponent],
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.css']
})
export class LogsComponent {
  logs: LogEntry[] = [
    {
      id: '1',
      type: 'User',
      timestamp: new Date(),
      user: 'jdoe',
      action: 'Login',
      status: 'Success',
      message: 'User logged in successfully.',
      ipAddress: '192.168.1.10'
    },
    {
      id: '2',
      type: 'System',
      timestamp: new Date(),
      action: 'Server Restart',
      status: 'Info',
      message: 'Server restarted for maintenance.',
      ipAddress: '127.0.0.1'
    },
    {
      id: '3',
      type: 'Error',
      timestamp: new Date(),
      user: 'admin',
      action: 'Data Import',
      status: 'Error',
      message: 'Failed to import data: Invalid format.',
      ipAddress: '192.168.1.20'
    },
    {
      id: '4',
      type: 'Audit',
      timestamp: new Date(),
      user: 'superadmin',
      action: 'Role Change',
      status: 'Warning',
      message: 'User role changed from User to Admin.',
      ipAddress: '192.168.1.30'
    }
  ];

  selectedLogs = new Set<string>();

  // Pagination properties
  currentPage = 1;
  pageSize = 10;
  totalLogs = this.logs.length;
  totalPages = 1;

  activeTab: 'system' | 'backup' = 'system';

  constructor(private dialog: MatDialog) {}

  exportLogs() {
    // Stub for export functionality
    alert('Exporting logs (stub)');
  }

  deleteSelected() {
    // Stub for delete functionality
    alert('Deleting selected logs (stub)');
  }

  refresh() {
    // Stub for refresh functionality
    alert('Refreshing logs (stub)');
  }

  toggleSelectAll() {
    if (this.selectedLogs.size === this.logs.length) {
      this.selectedLogs.clear();
    } else {
      this.logs.forEach(log => this.selectedLogs.add(log.id));
    }
  }

  onLogSelect(event: any, logId: string) {
    if (event.target.checked) {
      this.selectedLogs.add(logId);
    } else {
      this.selectedLogs.delete(logId);
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  openLogDetailsDialog(log: LogEntry) {
    this.dialog.open(LogOutputViewComponent, {
      width: '800px',
      height: '600px',
      data: { log }
    });
  }

  viewDetails(log: LogEntry) {
    this.openLogDetailsDialog(log);
  }
}
