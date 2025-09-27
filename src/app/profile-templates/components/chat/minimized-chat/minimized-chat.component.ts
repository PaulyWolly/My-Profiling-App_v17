import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-minimized-chat',
  templateUrl: './minimized-chat.component.html',
  styleUrls: ['./minimized-chat.component.css'],
  standalone: true
})
export class MinimizedChatComponent {
  @Input() chat: any;
  @Output() maximize = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  onMaximize() {
    this.maximize.emit();
  }

  onClose(event: MouseEvent) {
    event.stopPropagation();
    this.close.emit();
  }
} 