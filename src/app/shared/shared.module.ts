import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AlertComponent } from './components/alert/alert.component';
import { TitleComponent } from './components/title/title.component';
import { EditContentComponent } from './components/edit-content/edit-content.component';
import { ScrollableDirective } from './directives/scrollable.directive';
import { NewAccountEditModule } from './components/new-account-edit/new-account-edit.module';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { IdlePromptDialogComponent } from './components/idle-prompt-dialog/idle-prompt-dialog.component';

@NgModule({
  declarations: [
    AlertComponent,
    EditContentComponent,
    ConfirmDialogComponent,
    IdlePromptDialogComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    TitleComponent,
    ScrollableDirective,
    NewAccountEditModule
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    AlertComponent,
    TitleComponent,
    EditContentComponent,
    ScrollableDirective,
    NewAccountEditModule,
    ConfirmDialogComponent,
    MatDialogModule,
    MatButtonModule
  ]
})
export class SharedModule { }
