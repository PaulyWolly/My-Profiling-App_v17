import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AssetService {
    constructor(private http: HttpClient) {}

    private get assetBaseUrl() {
        return environment.apiUrl;
    }

    getAssetUrl(path: string): string {
        // Remove any leading slash
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        // Use backend port for assets
        return `${this.assetBaseUrl}/${cleanPath}`;
    }
} 