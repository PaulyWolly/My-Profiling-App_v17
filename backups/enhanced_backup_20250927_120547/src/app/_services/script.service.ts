import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Script {
  name: string;
  path: string;
}

export interface ScriptRun {
  _id: string;
  script: string;
  executedBy: string;
  date: Date;
  status: 'success' | 'error';
  output?: string;
  error?: string;
}

export interface ScriptRunResponse {
  success: boolean;
  stdout: string;
  stderr: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScriptService {
  constructor(private http: HttpClient) { }

  getScripts(): Observable<Script[]> {
    return this.http.get<Script[]>(`${environment.apiUrl}/admin/scripts/list`, { withCredentials: true });
  }

  runScript(scriptName: string): Observable<ScriptRunResponse> {
    return this.http.post<ScriptRunResponse>(`${environment.apiUrl}/admin/scripts/run/${scriptName}`, {}, { withCredentials: true });
  }

  getHistory(): Observable<ScriptRun[]> {
    return this.http.get<ScriptRun[]>(`${environment.apiUrl}/admin/scripts/history`, { withCredentials: true });
  }

  deleteHistoryEntry(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/scripts/history/${id}`, { withCredentials: true });
  }
} 