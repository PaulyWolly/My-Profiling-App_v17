import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProfileTemplatesComponent } from './profile-templates.component';
import { NewStandardPreviewComponent } from './components/previews/new-standard-preview/new-standard-preview.component';
import { NewSocialMediaPreviewComponent } from './components/previews/new-social-media-preview/new-social-media-preview.component';
import { NewBusinessPreviewComponent } from './components/previews/new-business-preview/new-business-preview.component';
import { NewSocialMediaProfileComponent } from './components/profiles/new-social-media-profile/new-social-media-profile.component';

const routes: Routes = [
    {
        path: '',
        component: ProfileTemplatesComponent
    },
    {
        path: 'standard',
        component: NewStandardPreviewComponent
    },
    {
        path: 'social-media',
        component: NewSocialMediaPreviewComponent
    },
    {
        path: 'new-social-media',
        component: NewSocialMediaProfileComponent
    },
    {
        path: 'business',
        component: NewBusinessPreviewComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class ProfileTemplatesRoutingModule { } 