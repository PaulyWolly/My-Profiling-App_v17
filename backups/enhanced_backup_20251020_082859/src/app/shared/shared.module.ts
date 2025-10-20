import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent } from './components/alert/alert.component';
import { TitleComponent } from './components/title/title.component';
import { EditContentComponent } from './components/edit-content/edit-content.component';
import { ScrollableDirective } from './directives/scrollable.directive';
import { NewAccountEditModule } from './components/new-account-edit/new-account-edit.module';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

@NgModule({
  declarations: [
    AlertComponent,
    EditContentComponent,
    ConfirmDialogComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
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
    ConfirmDialogComponent
  ]
})
export class SharedModule { }
