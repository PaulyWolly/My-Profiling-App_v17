import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="custom-tooltip"
      *ngIf="visible"
      [ngStyle]="{
        'top.px': top,
        'left.px': left,
        'background': bgColor,
        'color': textColor,
        'font-family': font,
        'border': border
      }"
    >
      {{ text }}
    </div>
  `,
  styleUrls: ['./custom-tooltip.component.scss']
})
export class CustomTooltipComponent {
  @Input() text = '';
  @Input() bgColor = '#222';
  @Input() textColor = '#fff';
  @Input() font = 'Arial, sans-serif';
  @Input() border = '1px solid #333';
  @Input() top = 0;
  @Input() left = 0;
  @Input() visible = false;
} 