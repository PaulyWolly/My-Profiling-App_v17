import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

interface LogEntry {
  id: string;
  type: 'User' | 'System' | 'Error' | 'Audit';
  timestamp: Date;
  user?: string;
  action: string;
  status: 'Success' | 'Warning' | 'Error' | 'Info';
  message: string;
  ipAddress?: string;
  meta?: any;
}

@Component({
  selector: 'app-super-admin-log-output-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
      <mat-card-title>Log Details</mat-card-title>
      <mat-card-content style="flex: 1 1 auto; overflow-y: auto;">
        <table style="width: 100%; font-size: 15px;">
          <tr><td><b>Type:</b></td><td>{{data.log.type}}</td></tr>
          <tr><td><b>Timestamp:</b></td><td>{{data.log.timestamp | date:'MMM d, yyyy, h:mm:ss a'}}</td></tr>
          <tr><td><b>User:</b></td><td>{{data.log.user || '-'}}</td></tr>
          <tr><td><b>Action/Event:</b></td><td>{{data.log.action}}</td></tr>
          <tr><td><b>Status:</b></td><td>{{data.log.status}}</td></tr>
          <tr><td><b>IP Address:</b></td><td>{{data.log.ipAddress || '-'}}</td></tr>
        </table>
        <div style="margin-top: 1.5em;">
          <b>Message:</b>
          <div *ngIf="!isMessagePaginated(); else paginatedMessage" style="white-space: pre-wrap; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 4px;">
            {{data.log.message}}
          </div>
          <ng-template #paginatedMessage>
            <div style="white-space: pre-wrap; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 4px;">
              {{getMessagePage()}}
            </div>
            <div style="margin-top: 8px; text-align: right;">
              <button mat-button (click)="prevMessagePage()" [disabled]="messagePage === 0">Previous</button>
              <span>Page {{messagePage+1}} of {{messageTotalPages}}</span>
              <button mat-button (click)="nextMessagePage()" [disabled]="messagePage >= messageTotalPages-1">Next</button>
            </div>
          </ng-template>
        </div>
        <div *ngIf="data.log.meta" style="margin-top: 1.5em;">
          <b>Meta:</b>
          <pre style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 4px; max-height: 200px; overflow: auto;">{{metaString}}</pre>
        </div>
      </mat-card-content>
      <mat-card-actions style="justify-content: flex-end;">
        <button mat-raised-button color="primary" (click)="close()">Close</button>
      </mat-card-actions>
    </mat-card>
  `
})
export class LogOutputViewComponent {
  messagePage = 0;
  messagePageSize = 1000; // characters per page
  messageTotalPages = 1;
  metaString = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { log: LogEntry },
    private dialogRef: MatDialogRef<LogOutputViewComponent>
  ) {
    if (data.log.meta) {
      this.metaString = typeof data.log.meta === 'string' ? data.log.meta : JSON.stringify(data.log.meta, null, 2);
    }
    if (this.isMessagePaginated()) {
      this.messageTotalPages = Math.ceil(data.log.message.length / this.messagePageSize);
    }
  }

  isMessagePaginated() {
    return this.data.log.message && this.data.log.message.length > this.messagePageSize;
  }

  getMessagePage() {
    const start = this.messagePage * this.messagePageSize;
    return this.data.log.message.substring(start, start + this.messagePageSize);
  }

  nextMessagePage() {
    if (this.messagePage < this.messageTotalPages - 1) {
      this.messagePage++;
    }
  }

  prevMessagePage() {
    if (this.messagePage > 0) {
      this.messagePage--;
    }
  }

  close() {
    this.dialogRef.close();
  }
}
