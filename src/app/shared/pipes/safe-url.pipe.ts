import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Pipe({
    name: 'safeUrl'
})
export class SafeUrlPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) {}

    transform(url: string | undefined): SafeUrl {
        if (!url) return '';
        
        // Skip cleaning for data URLs
        if (url.startsWith('data:')) {
            return this.sanitizer.bypassSecurityTrustUrl(url);
        }
        
        // Clean regular URLs by removing double slashes that aren't part of http://
        const cleanUrl = url.replace(/([^:]\/)\/+/g, '$1');
        return this.sanitizer.bypassSecurityTrustUrl(cleanUrl);
    }
} 