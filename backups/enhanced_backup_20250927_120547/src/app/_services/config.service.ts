import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';
import { AccountService } from './account.service';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: any = {};
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private accountService: AccountService
  ) {
    console.log('ConfigService initialized');
  }

  /**
   * Load configuration from the server
   * This should be called during app initialization
   */
  async loadConfig(): Promise<void> {
    // Return existing promise if already loading
    if (this.loadingPromise) {
      console.log('Config already loading, returning existing promise');
      return this.loadingPromise;
    }

    // Skip if already loaded successfully
    if (this.loaded && this.config?.apiKeys?.googleMaps) {
      console.log('Config already loaded with valid API key, skipping reload');
      return;
    }
    
    // Create loading promise
    this.loadingPromise = this._loadConfigInternal();
    
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async _loadConfigInternal(): Promise<void> {
    try {
      // Make sure we're authenticated first
      const user = this.accountService.accountValue;
      if (!user?.jwtToken) {
        console.warn('No authentication token available, cannot load config');
        return;
      }
      
      // Fetch configuration from the secure server endpoint
      console.log('Trying to load config from server endpoint:', `${environment.apiUrl}/config`);
      console.log('Using token:', user.jwtToken ? 'Yes (token available)' : 'No');
      
      this.config = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/config`)
      );
      
      console.log('Config loaded successfully:', JSON.stringify(this.config, null, 2));
      
      // If API key is still not available, log a warning
      if (!this.config?.apiKeys?.googleMaps) {
        console.warn('Google Maps API key not available from server. Check server configuration and response format.');
      } else {
        console.log('Google Maps API key found in config, length:', this.config.apiKeys.googleMaps.length);
      }
      
      this.loaded = true;
    } catch (error: any) {
      const httpError = error as HttpErrorResponse;
      console.error('Failed to load configuration. Status:', httpError.status);
      console.error('Error message:', error.message);
      console.error('Error details:', error);
      
      if (httpError.status === 401) {
        console.log('Authentication failed when loading config, trying to refresh token...');
        try {
          // Try to refresh the auth token
          await firstValueFrom(this.accountService.refreshToken());
          console.log('Token refreshed, retrying config load...');
          
          // Retry after token refresh
          this.config = await firstValueFrom(
            this.http.get(`${environment.apiUrl}/config`)
          );
          
          console.log('Config loaded successfully after token refresh');
          this.loaded = true;
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          // Fallback to empty config
          this.config = { apiKeys: { googleMaps: '' } };
          this.loaded = true;
        }
      } else {
        // Fallback to empty config for other errors
        this.config = { apiKeys: { googleMaps: '' } };
        this.loaded = true;
      }
    }
  }

  /**
   * Get the Google Maps API key
   */
  getGoogleMapsApiKey(): string {
    if (!this.loaded) {
      console.warn('Config not loaded yet. Call loadConfig() first.');
      
      // Try to load config now
      this.loadConfig().catch(err => console.error('Failed to load config on demand:', err));
      
      // Try to use direct key from environment as fallback
      if (environment.googleMapsApiKey) {
        console.log('Using API key from environment as fallback');
        return environment.googleMapsApiKey;
      }
      
      return '';
    }
    
    const apiKey = this.config?.apiKeys?.googleMaps || '';
    if (!apiKey && environment.googleMapsApiKey) {
      console.log('No API key in config, using environment fallback');
      return environment.googleMapsApiKey;
    }
    
    console.log('Returning Google Maps API key, available:', !!apiKey);
    return apiKey;
  }
} 