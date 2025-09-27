import { Component, Inject, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { ConfigService } from '@app/_services/config.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { catchError, firstValueFrom, of } from 'rxjs';

export interface MapDialogData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

@Component({
  selector: 'app-map-dialog',
  templateUrl: './map-dialog.component.html',
  styleUrls: ['./map-dialog.component.css']
})
export class MapDialogComponent implements OnInit, AfterViewInit {
  mapUrl!: SafeResourceUrl;
  directMapUrl!: SafeUrl;
  fullAddress: string;
  apiKeyAvailable = false;
  loadingMap = true;
  errorMessage = '';

  constructor(
    private sanitizer: DomSanitizer,
    public dialogRef: MatDialogRef<MapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MapDialogData,
    private configService: ConfigService,
    private http: HttpClient,
    private elementRef: ElementRef
  ) {
    // Set fixed dialog size
    this.dialogRef.updateSize('650px', 'auto');
    
    // Combine address components
    this.fullAddress = [
      data.address,
      data.city,
      data.state,
      data.zipCode
    ].filter(Boolean).join(', ');
    
    // Create direct Google Maps URL (doesn't require API key)
    const encodedDirectAddress = encodeURIComponent(this.fullAddress);
    this.directMapUrl = this.sanitizer.bypassSecurityTrustUrl(
      `https://www.google.com/maps/search/?api=1&query=${encodedDirectAddress}`
    );
  }

  ngAfterViewInit() {
    // Force dialog to specific size after it's been initialized
    setTimeout(() => {
      const dialogContainer = this.elementRef.nativeElement.closest('.cdk-overlay-pane');
      if (dialogContainer) {
        dialogContainer.style.width = '650px';
        dialogContainer.style.maxWidth = '90vw';
      }
    }, 0);
  }

  async ngOnInit(): Promise<void> {
    if (!this.fullAddress) {
      this.loadingMap = false;
      return;
    }

    try {
      // Attempt to load the API key directly from the config endpoint
      console.log('Fetching API key from config endpoint...');
      const encodedAddress = encodeURIComponent(this.fullAddress);
      
      // Try to get the config directly as a fallback
      const configResponse = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/config`).pipe(
          catchError(error => {
            console.error('Error fetching config:', error);
            return of({ apiKeys: { googleMaps: '' } });
          })
        )
      );
      
      const apiKey = configResponse?.apiKeys?.googleMaps || this.configService.getGoogleMapsApiKey();
      
      console.log('API key obtained:', apiKey ? 'Yes' : 'No');
      
      if (apiKey && this.fullAddress) {
        this.apiKeyAvailable = true;
        const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15&maptype=roadmap`;
        this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(googleMapsUrl);
        console.log('Map URL created successfully');
      } else {
        this.errorMessage = 'Could not load the map: Missing API key';
        console.error('Google Maps API key missing');
      }
    } catch (error) {
      console.error('Error loading map:', error);
      this.errorMessage = 'Error loading map. Please try again later.';
    } finally {
      this.loadingMap = false;
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
} 