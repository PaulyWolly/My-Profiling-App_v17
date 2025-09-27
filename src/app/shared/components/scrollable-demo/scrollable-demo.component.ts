import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollableDirective } from '../../directives/scrollable.directive';

@Component({
  selector: 'app-scrollable-demo',
  standalone: true,
  imports: [CommonModule, ScrollableDirective],
  template: `
    <div class="container mt-4">
      <h2>Scrollable Component Demo</h2>
      <p>This demonstrates the different ways to use the scrollable directive.</p>
      
      <div class="row mt-4">
        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h5>Small Scrollable (XS)</h5>
            </div>
            <div class="card-body app-scrollable app-scrollable-xs" appScrollable>
              <p *ngFor="let item of generateItems(20)">Item {{ item }}</p>
            </div>
          </div>
        </div>
        
        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h5>Medium Scrollable (MD)</h5>
            </div>
            <div class="card-body app-scrollable app-scrollable-md" appScrollable>
              <p *ngFor="let item of generateItems(20)">Item {{ item }}</p>
            </div>
          </div>
        </div>
        
        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h5>Large Scrollable (LG)</h5>
            </div>
            <div class="card-body app-scrollable app-scrollable-lg" appScrollable>
              <p *ngFor="let item of generateItems(20)">Item {{ item }}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5>Full Height Scrollable</h5>
            </div>
            <div class="card-body app-scrollable app-scrollable-full" appScrollable>
              <p *ngFor="let item of generateItems(50)">Item {{ item }}</p>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5>Custom Height Scrollable</h5>
              <small>With custom styles</small>
            </div>
            <div class="card-body app-scrollable" appScrollable style="max-height: 350px; background-color: #f8f9fa;">
              <div class="p-3 mb-2 bg-light rounded" *ngFor="let item of generateItems(15)">
                <h6>Content Block {{ item }}</h6>
                <p>This is a scrollable section with custom styling.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ScrollableDemoComponent {
  generateItems(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
} 