import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutComponent } from './containers/layout/layout.component';
import { ProfileComponent } from './containers/profile/profile.component';
import { DetailsComponent } from './containers/details/details.component';
import { EditComponent } from './containers/edit/edit.component';
import { EditProfileComponent } from '../profile-templates/components/edit-profile/edit-profile.component';
import { AccountSettingsComponent } from './containers/account-settings/account-settings.component';
import { NewStandardProfileComponent } from '../profile-templates/components/profiles/new-standard-profile/new-standard-profile.component';
import { NewSocialMediaProfileComponent } from '../profile-templates/components/profiles/new-social-media-profile/new-social-media-profile.component';
import { AuthGuard } from '../_helpers/auth.guard';

const routes: Routes = [
    {
        path: '',
        component: LayoutComponent,
        children: [
            {
                path: '',
                component: DetailsComponent,
                pathMatch: 'full'
            },
            { path: 'edit-profile', component: EditComponent },
            {
                path: 'account-settings',
                component: AccountSettingsComponent,
                canActivate: [AuthGuard]
            },
            { path: ':id', component: ProfileComponent }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class ProfileRoutingModule { }
