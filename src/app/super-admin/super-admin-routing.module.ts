import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SuperAdminSubnavComponent } from './components/super-admin-subnav/super-admin-subnav.component';
import { SuperAdminLayoutComponent } from './components/super-admin-layout/super-admin-layout.component';
import { LogsComponent } from './components/logs/logs.component';
import { SuperAdminOverviewComponent } from './components/super-admin-overview/super-admin-overview.component';

const routes: Routes = [
  {
    path: '',
    component: SuperAdminSubnavComponent,
    outlet: 'subnav'
  },
  {
    path: '',
    component: SuperAdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: SuperAdminOverviewComponent },
      { path: 'logs', component: LogsComponent },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperAdminRoutingModule { }
