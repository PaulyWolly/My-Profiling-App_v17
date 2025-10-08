import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { Alert, AlertOptions, AlertType } from '@app/_models';

@Injectable({ providedIn: 'root' })
export class AlertService {
    private subject = new Subject<Alert>();
    private defaultId = 'default-alert';

    // enable subscribing to alerts observable
    onAlert(id = this.defaultId): Observable<Alert> {
        return this.subject.asObservable().pipe(filter(x => x && x.id === id));
    }

    // convenience methods
    success(message: string, options?: AlertOptions) {
        console.log('[AlertService] Creating success alert:', message);
        this.alert(new Alert({ ...options, type: AlertType.Success, message }));
    }

    error(message: string | any, options?: AlertOptions) {
        console.log('[AlertService] Creating error alert:', message);
        
        // Handle error objects from the error interceptor
        if (message && typeof message === 'object') {
            if (message.message) {
                message = message.message;
            } else if (message.error?.message) {
                message = message.error.message;
            } else if (message.statusText) {
                message = message.statusText;
            } else {
                message = 'An unexpected error occurred';
            }
        }

        this.alert(new Alert({ ...options, type: AlertType.Error, message }));
    }

    info(message: string, options?: AlertOptions) {
        console.log('[AlertService] Creating info alert:', message);
        this.alert(new Alert({ ...options, type: AlertType.Info, message }));
    }

    warn(message: string, options?: AlertOptions) {
        console.log('[AlertService] Creating warning alert:', message);
        this.alert(new Alert({ ...options, type: AlertType.Warning, message }));
    }

    // core alert method
    alert(alert: Alert) {
        console.log('[AlertService] Emitting alert:', alert);
        alert.id = alert.id || this.defaultId;
        alert.autoClose = (alert.autoClose === undefined ? true : alert.autoClose);
        this.subject.next(alert);
    }

    // clear alerts
    clear(id = this.defaultId) {
        console.log('[AlertService] Clearing alerts for id:', id);
        this.subject.next(new Alert({ id }));
    }
}