import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-preview-template',
    standalone: true,
    imports: [CommonModule],
    template: `
        <h2 style="text-align: center; margin-bottom: 32px;">{{ title }}</h2>
        <div class="preview-template-card">
            <div class="preview-template-row">
                <div class="preview-template-content">
                    <ng-content select="[content]"></ng-content>
                </div>
                <div class="preview-template-description">
                    <div class="preview-template-buttons" style="text-align: right; margin-bottom: 16px;">
                        <ng-content select="[buttons]"></ng-content>
                    </div>
                    <div>
                        <ng-content select="[description]"></ng-content>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .preview-template-card {
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 2px 16px rgba(0,0,0,0.08);
            padding: 40px 32px;
            max-width: 1200px;
            margin: 0 auto 48px auto;
        }
        .preview-template-row {
            display: flex;
            align-items: flex-start;
            gap: 32px;
        }
        .preview-template-content {
            flex: 1;
            min-width: 300px;
            max-width: 600px;
        }
        .preview-template-description {
            flex: 1;
            min-width: 220px;
        }
    `]
})
export class PreviewTemplateComponent {
    @Input() title: string = '';
} 