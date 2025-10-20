import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { JwtHelperService, JWT_OPTIONS } from '@auth0/angular-jwt';
import { AuthModule } from '@auth0/auth0-angular';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

// Material Modules (Keep essential ones needed globally)
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';

import { AppRoutingModule } from '@app/app-routing.module';
import { JwtInterceptor, ErrorInterceptor, appInitializer } from '@app/_helpers';
import { AccountService } from '@app/_services';
import { ConfigService } from '@app/_services/config.service';
import { AppComponent } from '@app/app.component';
import { environment } from '@environments/environment';
import { FooterComponent } from './footer/footer.component';
import { AdminModule } from './admin/admin.module';
import { SharedModule } from './shared/shared.module';
import { ProfileModule } from './profile/profile.module';
import { ProfileTemplatesModule } from './profile-templates/profile-templates.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { NewMenuBarComponent } from './new-menu-bar/new-menu-bar.component';
import { SubNavComponent as AdminSubNavComponent } from './admin/components/subnav/subnav.component';
import { SuperAdminSubnavComponent } from './super-admin/components/super-admin-subnav/super-admin-subnav.component';

// Add factory function to initialize ConfigService
export function configInitializer(configService: ConfigService) {
    return () => configService.loadConfig();
}

@NgModule({
    declarations: [
        AppComponent,
        FooterComponent,
        NewMenuBarComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        ReactiveFormsModule,
        HttpClientModule,
        RouterModule,
        MatSnackBarModule,
        MatIconModule,
        MatButtonModule,
        MatBadgeModule,
        AppRoutingModule,
        AdminModule,
        SharedModule,
        ProfileModule,
        ProfileTemplatesModule,
        SuperAdminModule,
        CommonModule,
        AdminSubNavComponent,
        SuperAdminSubnavComponent,
        // Auth0 Module
        AuthModule.forRoot({
            domain: environment.auth0.domain,
            clientId: environment.auth0.clientId,
            authorizationParams: environment.auth0.authorizationParams
        })
    ],
    providers: [
        { provide: APP_INITIALIZER, useFactory: appInitializer, multi: true, deps: [AccountService] },
        { provide: APP_INITIALIZER, useFactory: configInitializer, multi: true, deps: [ConfigService] },
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: JWT_OPTIONS, useValue: JWT_OPTIONS },
        JwtHelperService
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    bootstrap: [AppComponent]
})
export class AppModule { }
