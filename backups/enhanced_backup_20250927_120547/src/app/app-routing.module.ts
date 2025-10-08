import { superAdminGuard } from './guards/super-admin.guard';
import { NgModule } from '@angular/core';
import { Routes, RouterModule, PreloadAllModules } from '@angular/router';

import { AuthGuard } from './_helpers';
import { Role } from './_models';
import { SuperAdminModule } from './super-admin/super-admin.module';

const accountModule = () => import('./account/account.module').then(x => x.AccountModule);
const adminModule = () => import('./admin/admin.module').then(x => x.AdminModule);
const profileModule = () => import('./profile/profile.module').then(x => x.ProfileModule);
const profileTemplatesModule = () => import('./profile-templates/profile-templates.module').then(x => x.ProfileTemplatesModule);

const routes: Routes = [
    { path: '', redirectTo: 'profile', pathMatch: 'full' },
    { path: 'account', loadChildren: accountModule },
    { path: 'profile', loadChildren: profileModule, canActivate: [AuthGuard] },
    { path: 'profile-templates', loadChildren: profileTemplatesModule, canActivate: [AuthGuard] },
    { path:
      'admin',
      loadChildren: adminModule,
      canActivate: [AuthGuard],
      data: { roles: [Role.Admin, Role.SuperAdmin] }
    },
    { path:
      'super-admin',
      loadChildren: () => import('./super-admin/super-admin.module').then(m => m.SuperAdminModule),
      canActivate: [AuthGuard],
      data: { roles: [Role.SuperAdmin] }
    },

    // Only redirect for truly unknown routes, not page refreshes
    { path: '**', redirectTo: 'profile' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {
        preloadingStrategy: PreloadAllModules,
        onSameUrlNavigation: 'reload',
        scrollPositionRestoration: 'enabled',
        useHash: false,
        anchorScrolling: 'enabled',
        initialNavigation: 'enabledBlocking',
        enableTracing: true // Enable for debugging
    })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
