import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AdminRoutingModule } from './admin-clone-routing.module';
import { SubNavComponent } from './components/subnav/subnav.component';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { OverviewComponent } from './components/overview/overview.component';
import { MonitorComponent } from './components/monitor/monitor.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ScriptsComponent } from './scripts/scripts.component';
import { AdminComponent } from './admin-clone.component';
import { CommandModalComponent } from './scripts/command-modal.component';
import { CommandModalInputComponent } from './scripts/command-modal-input.component';
import { LogsComponent } from './components/logs/logs.component';
import { AdminCloneSubnavComponent } from './components/admin-clone-subnav/admin-clone-subnav.component';

@NgModule({
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        RouterModule,
        AdminRoutingModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatProgressSpinnerModule,
        MatTabsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        OverviewComponent,
        MonitorComponent,
        SettingsComponent,
        LogsComponent,
        SubNavComponent
    ],
    declarations: [
        AdminLayoutComponent,
        ScriptsComponent,
        AdminComponent,
        CommandModalComponent,
        CommandModalInputComponent,
        AdminCloneSubnavComponent
    ]
})
export class AdminCloneModule { }
