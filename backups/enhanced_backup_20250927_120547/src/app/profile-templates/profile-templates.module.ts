import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ProfileTemplatesComponent } from './profile-templates.component';
import { ProfileTemplatesRoutingModule } from './profile-templates-routing.module';
import { NewStandardPreviewComponent } from './components/previews/new-standard-preview/new-standard-preview.component';
import { NewSocialMediaPreviewComponent } from './components/previews/new-social-media-preview/new-social-media-preview.component';
import { NewBusinessPreviewComponent } from './components/previews/new-business-preview/new-business-preview.component';
import { AssetService } from '@app/_services/asset.service';
import { ChatService } from '@app/_services/chat.service';
import { SharedModule } from '@app/shared/shared.module';
import { NewSocialMediaProfileComponent } from './components/profiles/new-social-media-profile/new-social-media-profile.component';
import { NewBusinessProfileComponent } from './components/profiles/new-business-profile/new-business-profile.component';
import { NewStandardProfileComponent } from './components/profiles/new-standard-profile/new-standard-profile.component';
import { ChatDockComponent } from './components/chat/chat-dock/chat-dock.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';

@NgModule({
    declarations: [
        ProfileTemplatesComponent,
        EditProfileComponent,
    ],
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        ProfileTemplatesRoutingModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        SharedModule,
        // Standalone Components
        NewStandardPreviewComponent,
        NewSocialMediaPreviewComponent,
        NewBusinessPreviewComponent,
        NewSocialMediaProfileComponent,
        NewBusinessProfileComponent,
        NewStandardProfileComponent,
        ChatDockComponent
    ],
    exports: [
        ProfileTemplatesComponent,
        ChatDockComponent,
        NewStandardPreviewComponent,
        NewSocialMediaPreviewComponent,
        NewBusinessPreviewComponent,
        NewSocialMediaProfileComponent,
        NewBusinessProfileComponent,
        NewStandardProfileComponent,
        EditProfileComponent
    ],
    providers: [
        AssetService,
        ChatService
    ]
})
export class ProfileTemplatesModule { } 