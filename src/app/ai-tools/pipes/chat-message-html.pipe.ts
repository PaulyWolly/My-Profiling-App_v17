import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'chatMessageHtml', standalone: true })
export class ChatMessageHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * @param value assistant message text
   * @param factValues optional memory values to render in bold when they appear
   */
  transform(value: string | null | undefined, factValues?: string[] | null): SafeHtml {
    if (!value) {
      return '';
    }

    let html = this.escapeHtml(value);

    // Bold known memory details (longest first so "Paul Welby" wins over "Paul")
    html = this.boldFactValues(html, factValues);

    // Markdown bold the model may emit: **Paul**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    html = html.replace(
      /(^|[\s(])((https?:\/\/)[^\s<)]+)/gi,
      (match, prefix, url) => `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );

    html = html.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private boldFactValues(html: string, factValues?: string[] | null): string {
    if (!factValues?.length) {
      return html;
    }

    const unique = Array.from(
      new Set(
        factValues
          .map((v) => String(v || '').trim())
          .filter((v) => v.length >= 2)
      )
    ).sort((a, b) => b.length - a.length);

    let out = html;
    for (const raw of unique) {
      const escapedFact = this.escapeHtml(raw);
      if (!escapedFact) continue;

      // Skip if already inside a <strong>…</strong> for this pass (simple guard)
      const pattern = new RegExp(`(?<!<strong>)(${this.escapeRegExp(escapedFact)})(?!</strong>)`, 'gi');
      out = out.replace(pattern, '<strong>$1</strong>');
    }
    return out;
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
