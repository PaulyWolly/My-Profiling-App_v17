import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'my', 'i',
  'is', 'are', 'am', 'be', 'as', 'at', 'by', 'from', 'it', 'this', 'that', 'especially'
]);

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

    // Bold known memory details (full values + meaningful fragments)
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

    const phrases = this.expandFactPhrases(factValues);
    let out = html;

    for (const raw of phrases) {
      const escapedFact = this.escapeHtml(raw);
      if (!escapedFact) continue;

      // Avoid matching inside existing tags or already-bold text
      const pattern = new RegExp(
        `(?<![\\w/;])(${this.escapeRegExp(escapedFact)})(?![\\w/;])(?![^<]*</strong>)`,
        'gi'
      );
      out = out.replace(pattern, (match, _g1, offset: number, full: string) => {
        const before = full.slice(Math.max(0, offset - 20), offset);
        if (before.includes('<strong>') && !before.includes('</strong>')) {
          return match;
        }
        return `<strong>${match}</strong>`;
      });
    }
    return out;
  }

  /** Full fact values plus useful fragments (e.g. avocados/olives → both words). */
  private expandFactPhrases(factValues: string[]): string[] {
    const phrases = new Set<string>();

    for (const value of factValues) {
      const trimmed = String(value || '').trim();
      if (trimmed.length >= 2) {
        phrases.add(trimmed);
      }

      // Split compound values: "avocados/olives", "pickled things (especially …)"
      const parts = trimmed
        .split(/[/|,;()]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 3);

      for (const part of parts) {
        phrases.add(part);
        // Also keep multi-word parts intact; add significant words (length >= 5)
        for (const word of part.split(/\s+/)) {
          const w = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
          if (w.length >= 5 && !STOPWORDS.has(w.toLowerCase())) {
            phrases.add(w);
          }
        }
      }
    }

    return Array.from(phrases).sort((a, b) => b.length - a.length);
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
