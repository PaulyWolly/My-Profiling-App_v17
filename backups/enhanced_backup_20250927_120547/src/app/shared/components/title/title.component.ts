import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-title',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './title.component.html',
  styleUrls: ['./title.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitleComponent {
  @Input() text!: string;
  @Input() level: 1 | 2 | 3 | 4 | 5 | 6 = 2;
  @Input() subtitle?: string;
  @Input() alignment: 'left' | 'center' | 'right' = 'left';
  @Input() marginBottom: string = 'default';
  @Input() appHeader: boolean = false;

  get titleClasses() {
    return {
      [`align-${this.alignment}`]: true,
      [`title-mb-${this.marginBottom}`]: true
    };
  }
}