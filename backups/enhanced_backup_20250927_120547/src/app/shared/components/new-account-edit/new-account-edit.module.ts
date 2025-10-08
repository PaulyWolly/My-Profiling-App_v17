import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NewAccountEditComponent } from './new-account-edit.component';

@NgModule({
  declarations: [
    NewAccountEditComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  exports: [
    NewAccountEditComponent
  ]
})
export class NewAccountEditModule { } 