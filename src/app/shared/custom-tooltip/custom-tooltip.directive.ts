import {
  Directive, Input, HostListener, OnDestroy, ApplicationRef, ComponentRef, ComponentFactoryResolver, Injector
} from '@angular/core';
import { CustomTooltipComponent } from './custom-tooltip.component';

@Directive({
  selector: '[appCustomTooltip]',
  standalone: true
})
export class CustomTooltipDirective implements OnDestroy {
  @Input('appCustomTooltip') text = '';
  @Input() tooltipBgColor = '#222';
  @Input() tooltipTextColor = '#fff';
  @Input() tooltipFont = 'Arial, sans-serif';
  @Input() tooltipBorder = '1px solid #333';
  @Input() tooltipPosition: 'auto' | 'left' | 'right' | 'top' | 'bottom' = 'auto';

  private tooltipRef: ComponentRef<CustomTooltipComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private resolver: ComponentFactoryResolver,
    private injector: Injector
  ) {}

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent) {
    if (!this.tooltipRef) {
      const factory = this.resolver.resolveComponentFactory(CustomTooltipComponent);
      this.tooltipRef = factory.create(this.injector);
      this.setTooltipProps(event);
      this.tooltipRef.instance.visible = true;
      this.appRef.attachView(this.tooltipRef.hostView);
      document.body.appendChild((this.tooltipRef.hostView as any).rootNodes[0]);
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.tooltipRef) {
      this.setTooltipProps(event);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.hideTooltip();
  }

  ngOnDestroy() {
    this.hideTooltip();
  }

  private hideTooltip() {
    if (this.tooltipRef) {
      this.appRef.detachView(this.tooltipRef.hostView);
      this.tooltipRef.destroy();
      this.tooltipRef = null;
    }
  }

  private setTooltipProps(event: MouseEvent) {
    if (this.tooltipRef) {
      this.tooltipRef.instance.text = this.text;
      this.tooltipRef.instance.bgColor = this.tooltipBgColor;
      this.tooltipRef.instance.textColor = this.tooltipTextColor;
      this.tooltipRef.instance.font = this.tooltipFont;
      this.tooltipRef.instance.border = this.tooltipBorder;
      
      // Calculate position based on tooltipPosition setting
      const position = this.calculatePosition(event);
      this.tooltipRef.instance.top = position.top;
      this.tooltipRef.instance.left = position.left;
    }
  }

  private calculatePosition(event: MouseEvent): { top: number; left: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 120; // Approximate tooltip width
    const tooltipHeight = 30; // Approximate tooltip height
    const offset = 12;

    switch (this.tooltipPosition) {
      case 'left':
        return {
          top: event.clientY - tooltipHeight / 2,
          left: event.clientX - tooltipWidth - offset
        };
      case 'right':
        return {
          top: event.clientY - tooltipHeight / 2,
          left: event.clientX + offset
        };
      case 'top':
        return {
          top: event.clientY - tooltipHeight - offset,
          left: event.clientX - tooltipWidth / 2
        };
      case 'bottom':
        return {
          top: event.clientY + offset,
          left: event.clientX - tooltipWidth / 2
        };
      case 'auto':
      default:
        // Auto positioning - prefer left if near right edge, top if near bottom edge
        let left = event.clientX + offset;
        let top = event.clientY + offset;

        // If too close to right edge, position to the left
        if (left + tooltipWidth > viewportWidth - 20) {
          left = event.clientX - tooltipWidth - offset;
        }

        // If too close to bottom edge, position above
        if (top + tooltipHeight > viewportHeight - 20) {
          top = event.clientY - tooltipHeight - offset;
        }

        return { top, left };
    }
  }
} 