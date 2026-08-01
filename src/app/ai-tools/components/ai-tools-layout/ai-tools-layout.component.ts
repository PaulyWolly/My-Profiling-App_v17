import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';

/**
 * Routes that opt out of the centered 960px column. Each one sizes itself: the
 * two-column tools fill the window, chat takes 80% of it.
 */
const WIDE_ROUTES = ['/ai-tools/chat', '/ai-tools/generate', '/ai-tools/rag', '/ai-tools/image'];

@Component({
  selector: 'app-ai-tools-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ai-tools-layout.component.html',
  styleUrls: ['./ai-tools-layout.component.css']
})
export class AiToolsLayoutComponent implements OnDestroy {
  wide = false;

  private readonly sub: Subscription;

  constructor(private router: Router) {
    this.sub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.updateWide());
    this.updateWide();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private updateWide(): void {
    this.wide = WIDE_ROUTES.some((route) => this.router.url.startsWith(route));
  }
}
