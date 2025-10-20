import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { TitleComponent } from '@app/shared/components/title/title.component';

@Component({
  selector: 'app-scripts',
  standalone: true,
  imports: [CommonModule, TitleComponent],
  templateUrl: './scripts.component.html',
  styleUrls: ['./scripts.component.css']
})
export class ScriptsComponent implements OnInit {
  scripts: string[] = [];
  history: any[] = [];
  loading = false;
  runningScript: string | null = null;
  scriptOutput: string = '';
  scriptError: string = '';
  showModal = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchScripts();
    this.fetchHistory();
  }

  fetchScripts() {
    this.loading = true;
    this.http.get<string[]>('/api/admin/scripts', { withCredentials: true }).subscribe({
      next: scripts => { this.scripts = scripts; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  fetchHistory() {
    this.http.get<any[]>('/api/admin/scripts/history', { withCredentials: true }).subscribe(history => {
      this.history = history;
    });
  }

  runScript(script: string) {
    this.runningScript = script;
    this.scriptOutput = '';
    this.scriptError = '';
    this.showModal = false;
    this.http.post<any>('/api/admin/scripts/run', { scriptName: script }, { withCredentials: true }).subscribe({
      next: res => {
        this.scriptOutput = res.stdout;
        this.scriptError = res.stderr;
        this.showModal = true;
        this.runningScript = null;
        this.fetchHistory();
      },
      error: err => {
        this.scriptError = err.error?.error || 'Error running script';
        this.showModal = true;
        this.runningScript = null;
      }
    });
  }

  closeModal() {
    this.showModal = false;
  }
} 