import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AccountRoutingModule } from './account-routing.module';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { NewRegisterComponent } from './components/new-register/new-register.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { LayoutComponent } from './components/layout/layout.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { EditAccountComponent } from './components/edit-account/edit-account.component';
import { SharedModule } from '@app/shared/shared.module';
import { NewHeaderComponent } from './components/new-header/new-header.component';
import { MySessionsComponent } from './components/my-sessions/my-sessions.component';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        AccountRoutingModule,
        SharedModule,
        MatTableModule,
        MatButtonModule
    ],
    declarations: [
        LoginComponent,
        ResetPasswordComponent,
        NewRegisterComponent,
        ForgotPasswordComponent,
        LayoutComponent,
        WelcomeComponent,
        EditAccountComponent,
        NewHeaderComponent,
        MySessionsComponent
    ],
    providers: [
        DatePipe
    ]
})
export class AccountModule { }