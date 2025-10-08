import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CommandModalComponent } from './command-modal.component';
import { CommandModalInputComponent } from './command-modal-input.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

interface ScriptExecution {
  _id: string;
  script: string;
  timestamp: Date;
  output: string;
  error: string;
}

interface ScriptMeta {
  name: string;
  input: boolean;
}

@Component({
  selector: 'app-scripts',
  templateUrl: './scripts.component.html',
  styleUrls: ['./scripts.component.scss']
})
export class ScriptsComponent implements OnInit {
  scripts: ScriptMeta[] = [];
  history: ScriptExecution[] = [];
  selectedScript: string | null = null;
  isRunning = false;
  output: string = '';
  error: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadScripts();
    this.loadHistory();
  }

  loadScripts() {
    this.http.get<ScriptMeta[]>(`${environment.apiUrl}/api/admin/scripts`, { withCredentials: true })
      .subscribe({
        next: (scripts) => {
          this.scripts = scripts;
        },
        error: (error) => {
          console.error('Error loading scripts:', error);
          if (error.status === 401 || error.status === 403) {
            this.router.navigate(['/login']);
          } else {
            this.error = 'Failed to load scripts';
          }
        }
      });
  }

  loadHistory() {
    this.http.get<ScriptExecution[]>(`${environment.apiUrl}/api/admin/scripts/history`, { withCredentials: true })
      .subscribe({
        next: (history) => {
          this.history = history;
        },
        error: (error) => {
          console.error('Error loading history:', error);
          if (error.status === 401 || error.status === 403) {
            this.router.navigate(['/login']);
          } else {
            this.error = 'Failed to load script history';
          }
        }
      });
  }

  runScript(script: ScriptMeta) {
    if (script.input) {
      // Open CommandModalInputComponent (input required)
      this.http.post<any>(`${environment.apiUrl}/api/admin/scripts/interactive-run/start`, { scriptName: script.name }, { withCredentials: true })
        .subscribe({
          next: (res) => {
            const dialogRef = this.dialog.open(CommandModalInputComponent, {
              data: { output: res.output, sessionId: res.sessionId, scriptName: script.name },
              width: '800px',
              disableClose: true
            });
            const dialogComponent = dialogRef.componentInstance;
            dialogRef.afterClosed().subscribe();
            dialogComponent.onSubmitInput = (input: string, sessionId: string) => {
              this.http.post<any>(`${environment.apiUrl}/api/admin/scripts/interactive-run/input`, { sessionId, input }, { withCredentials: true })
                .subscribe({
                  next: (resp) => {
                    dialogComponent.updateOutput(resp.output, sessionId);
                  },
                  error: (err) => {
                    alert('Error sending input: ' + (err.error?.error || err.message));
                  }
                });
            };
          },
          error: (err) => {
            alert('Error starting interactive script: ' + (err.error?.error || err.message));
          }
        });
    } else {
      // Open CommandModalComponent (no input required)
      this.http.post<{ code: number; stdout: string; stderr: string }>(
        `${environment.apiUrl}/api/admin/scripts/run`,
        { scriptName: script.name },
        { withCredentials: true }
      ).subscribe({
        next: (response) => {
          this.dialog.open(CommandModalComponent, {
            data: { output: response.stdout, scriptName: script.name, sessionId: '' },
            width: '800px',
            disableClose: true
          });
          this.output = response.stdout;
          this.error = response.stderr;
          this.isRunning = false;
          this.loadHistory();
        },
        error: (error) => {
          console.error('Error running script:', error);
          if (error.status === 401 || error.status === 403) {
            this.router.navigate(['/login']);
          } else {
            this.error = 'Failed to run script';
          }
          this.isRunning = false;
        }
      });
    }
  }

  deleteHistoryItem(entry: ScriptExecution) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Are you <b>sure</b> you want to delete this item?', message: '' },
      width: '480px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        // Send DELETE request to backend
        this.http.delete(`${environment.apiUrl}/api/admin/scripts/history/${entry._id}`, { withCredentials: true })
          .subscribe({
            next: () => {
              // Remove from UI after successful delete
              this.history = this.history.filter(e => e !== entry);
            },
            error: (error) => {
              // Optionally show an error message
              console.error('Failed to delete history item:', error);
            }
          });
      }
    });
  }
} 