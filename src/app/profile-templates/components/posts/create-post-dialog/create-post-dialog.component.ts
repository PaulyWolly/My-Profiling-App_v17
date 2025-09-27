import { Component, Inject, Input } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';

export interface CreatePostData {
  users: { id: string; name: string }[];
  senderId: string;
  respondingTo?: any; // The post being responded to
}

@Component({
  selector: 'app-create-post-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    FormsModule
  ],
  templateUrl: './create-post-dialog.component.html',
  styleUrls: ['./create-post-dialog.component.scss']
})
export class CreatePostDialogComponent {
  recipientId: string = '';
  content: string = '';
  isResponse: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<CreatePostDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreatePostData
  ) {
    // If this is a response, pre-fill the recipient and add a reference
    if (data.respondingTo) {
      this.isResponse = true;
      this.recipientId = data.respondingTo.sender.id;
      this.content = `@${data.respondingTo.sender.firstName} ${data.respondingTo.sender.lastName} `;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.recipientId && this.content.trim()) {
      this.dialogRef.close({
        recipientId: this.recipientId,
        content: this.content.trim(),
        senderId: this.data.senderId,
        respondingTo: this.data.respondingTo
      });
    }
  }
} 