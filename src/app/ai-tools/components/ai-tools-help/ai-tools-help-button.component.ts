import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiToolsStatus } from '../../services/ai-tools.service';
import { HelpTopic } from './ai-tools-help.content';
import { AiToolsHelpDialogComponent } from './ai-tools-help-dialog.component';

/** Opens the guide for one tool. Sits in that tool's page heading. */
@Component({
  selector: 'app-ai-tools-help-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="ai-help-button"
      (click)="open()"
      [matTooltip]="label"
      [attr.aria-label]="label">
      <mat-icon>help_outline</mat-icon>
    </button>
  `,
  styles: [`
    /* The host sits directly in flex toolbars, so it must line up like a button. */
    :host {
      display: inline-flex;
      align-items: center;
    }
    .ai-help-button {
      color: #1565c0;
    }
    .ai-help-button:hover {
      background: #e3f2fd;
    }
  `]
})
export class AiToolsHelpButtonComponent {
  @Input({ required: true }) topic!: HelpTopic;
  /** Lets a page hand over the status it already loaded, avoiding a second call. */
  @Input() status: AiToolsStatus | null = null;
  @Input() label = 'Help and limits';

  constructor(private dialog: MatDialog) {}

  open(): void {
    this.dialog.open(AiToolsHelpDialogComponent, {
      panelClass: 'ai-tools-help-panel',
      autoFocus: false,
      restoreFocus: true,
      data: { topic: this.topic, status: this.status }
    });
  }
}
