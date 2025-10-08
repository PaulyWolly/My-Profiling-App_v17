import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.scss']
})
export class StarRatingComponent {
  @Input() rating: number = 0; // e.g. 3.5
  @Input() readonly: boolean = false;
  @Output() ratingChange = new EventEmitter<number>();

  hoverRating: number | null = null;

  get displayRating(): number {
    return this.hoverRating !== null ? this.hoverRating : this.rating;
  }

  setRating(value: number) {
    if (!this.readonly) {
      this.rating = value;
      this.ratingChange.emit(this.rating);
    }
  }

  setHover(value: number) {
    if (!this.readonly) {
      this.hoverRating = value;
    }
  }

  clearHover() {
    this.hoverRating = null;
  }

  // Helper to determine star fill (full, half, empty)
  getStarType(index: number): 'full' | 'half' | 'empty' {
    const rating = this.displayRating;
    if (rating >= index + 1) return 'full';
    if (rating >= index + 0.5) return 'half';
    return 'empty';
  }

  // Helper to determine mouse X position over a star (0 = left, 1 = right)
  getMouseX(event: MouseEvent): number {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    return (event.clientX - rect.left) / rect.width;
  }
} 