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

import { SuperAdminRoutingModule } from './super-admin-routing.module';
import { SuperAdminLayoutComponent } from './components/super-admin-layout/super-admin-layout.component';
import { LogsComponent } from './components/logs/logs.component';
import { SuperAdminSubnavComponent } from './components/super-admin-subnav/super-admin-subnav.component';
import { SuperAdminOverviewComponent } from './components/super-admin-overview/super-admin-overview.component';

@NgModule({
    imports: [
      CommonModule,
      ReactiveFormsModule,
      FormsModule,
      RouterModule,
      SuperAdminRoutingModule,
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
      SuperAdminSubnavComponent,
      SuperAdminOverviewComponent,
      LogsComponent
    ],
    declarations: [
      SuperAdminLayoutComponent
    ]
})
export class SuperAdminModule { }
