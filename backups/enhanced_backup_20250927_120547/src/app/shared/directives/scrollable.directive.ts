import { Directive, HostListener, ElementRef, OnInit, Renderer2, AfterViewInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appScrollable], .scrolling-div',
  standalone: true
})
export class ScrollableDirective implements OnInit, OnDestroy {
  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    // Apply the scrollable styling to the element
    this.renderer.addClass(this.el.nativeElement, 'app-scrollable');
    
    // Set properties directly to ensure they work in all browsers
    this.renderer.setStyle(this.el.nativeElement, 'overflow-y', 'auto');
    this.renderer.setStyle(this.el.nativeElement, 'position', 'relative');
    this.renderer.setStyle(this.el.nativeElement, 'scroll-behavior', 'auto');
    this.renderer.setStyle(this.el.nativeElement, '-webkit-overflow-scrolling', 'touch');
    
    // Special handling for edit-profile scrolling-div - increase height and add GPU acceleration
    if (this.el.nativeElement.classList.contains('scrolling-div')) {
      this.renderer.setStyle(this.el.nativeElement, 'max-height', 'calc(88vh - 120px)');
      this.renderer.setStyle(this.el.nativeElement, 'will-change', 'transform');
      this.renderer.setStyle(this.el.nativeElement, 'transform', 'translateZ(0)');
    }
  }
  
  // We're removing the custom wheel handlers that were causing the performance issues
  // Let the browser handle scrolling natively for better performance
  
  // Clean up when directive is destroyed
  ngOnDestroy() {
    // No event listeners to clean up now
  }
} 