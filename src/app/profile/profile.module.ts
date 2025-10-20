import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SharedModule } from '../shared/shared.module';
import { ProfileTemplatesModule } from '../profile-templates/profile-templates.module';
import { AccountModule } from '../account/account.module';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';

// Routing
import { ProfileRoutingModule } from './profile-routing.module';
import { CustomTooltipDirective } from '../shared/custom-tooltip/custom-tooltip.directive';

// Container Components
import { ProfileComponent } from './containers/profile/profile.component';
import { LayoutComponent } from './containers/layout/layout.component';
import { DetailsComponent } from './containers/details/details.component';
import { EditComponent } from './containers/edit/edit.component';
import { AccountSettingsComponent } from './containers/account-settings/account-settings.component';

// Presentational Components
import { MapDialogComponent } from './components/map-dialog/map-dialog.component';

// Standalone Profile Template Components
import { NewStandardProfileComponent } from '../profile-templates/components/profiles/new-standard-profile/new-standard-profile.component';
import { NewBusinessProfileComponent } from '../profile-templates/components/profiles/new-business-profile/new-business-profile.component';
import { NewSocialMediaProfileComponent } from '../profile-templates/components/profiles/new-social-media-profile/new-social-media-profile.component';
import { ChatDockComponent } from '../profile-templates/components/chat/chat-dock/chat-dock.component';

// Custom Directive to prevent wheel event propagation
import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
    selector: '[preventWheelPropagation]'
})
export class PreventWheelPropagationDirective {
    constructor(private el: ElementRef) {}

    @HostListener('wheel', ['$event'])
    onWheel(event: Event) {
        event.stopPropagation();
    }
}

@NgModule({
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        ProfileRoutingModule,
        SharedModule,
        ProfileTemplatesModule,
        // Material modules
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatTabsModule,
        MatProgressSpinnerModule,
        MatBadgeModule,
        MatInputModule,
        MatFormFieldModule,
        MatDialogModule,
        MatExpansionModule,
        MatTooltipModule,
        AccountModule,
        CustomTooltipDirective,
        // Standalone profile template components
        NewStandardProfileComponent,
        NewBusinessProfileComponent,
        NewSocialMediaProfileComponent,
        ChatDockComponent
    ],
    declarations: [
        ProfileComponent,
        LayoutComponent,
        DetailsComponent,
        EditComponent,
        AccountSettingsComponent,
        MapDialogComponent,
        PreventWheelPropagationDirective
    ],
    exports: [
        ProfileComponent,
        PreventWheelPropagationDirective
    ]
})
export class ProfileModule { }
