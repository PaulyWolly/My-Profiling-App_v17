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

    // Model sometimes invents "avocados/olives" — rewrite known list items as CSV first
    const normalized = this.rewriteSlashJoinedMemoryItems(value, factValues);
    let html = this.escapeHtml(normalized);

    // Bold known memory details (full values + meaningful fragments)
    html = this.boldFactValues(html, factValues);

    // Markdown bold the model may emit: **Paul**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Markdown images: ![Blue-ringed octopus](https://...)
    // Must run before link conversion so ![alt](url) is not treated as a text link.
    html = html.replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
      (_match, alt, url) => {
        const safeAlt = alt || 'Image';
        return (
          `<figure class="chat-image">` +
          `<a href="${url}" target="_blank" rel="noopener noreferrer">` +
          `<img src="${url}" alt="${safeAlt}" loading="lazy" referrerpolicy="no-referrer" />` +
          `</a>` +
          (alt ? `<figcaption>${alt}</figcaption>` : '') +
          `</figure>`
        );
      }
    );

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

  /**
   * Anything whose slashes carry meaning: links, markdown link targets, and code
   * spans. A path like ".../wikipedia/commons/0/0b/" reads as a list to the
   * rewrite below, which turned real URLs into "org, wikipedia, commons".
   */
  private static readonly LITERAL_SPANS = /(?:https?:\/\/|www\.)[^\s<>()]+|`[^`]*`|\]\([^)]*\)/gi;

  /**
   * Rewrite slash-joined list items as CSV English, skipping any span whose
   * slashes are structural.
   * **avocados/olives** → **avocados**, **olives**
   * avocados/olives → avocados, olives
   */
  private rewriteSlashJoinedMemoryItems(text: string, factValues?: string[] | null): string {
    const literals = ChatMessageHtmlPipe.LITERAL_SPANS;
    literals.lastIndex = 0;

    let out = '';
    let cursor = 0;
    let span: RegExpExecArray | null;

    while ((span = literals.exec(text)) !== null) {
      out += this.slashItemsToCsv(text.slice(cursor, span.index), factValues);
      out += span[0];
      cursor = span.index + span[0].length;
    }

    return out + this.slashItemsToCsv(text.slice(cursor), factValues);
  }

  private slashItemsToCsv(text: string, factValues?: string[] | null): string {
    if (!text.includes('/')) {
      return text;
    }

    const known = new Set(
      (factValues?.length ? this.expandFactPhrases(factValues) : []).map((p) => p.toLowerCase())
    );

    const isListPart = (p: string): boolean =>
      /^[A-Za-z][A-Za-z0-9\s'-]{1,40}$/.test(p) && !/\d{2,}/.test(p);

    const toCsv = (parts: string[]): string | null => {
      if (parts.length < 2 || !parts.every(isListPart)) {
        return null;
      }
      // Prefer rewriting when parts are remembered likes, or always for short alphabetic lists
      const allKnown = parts.every((p) => known.has(p.toLowerCase()));
      const looksLikeFoodList = parts.every((p) => p.length >= 3 && !/\d/.test(p));
      if (!allKnown && !looksLikeFoodList) {
        return null;
      }
      return parts.join(', ');
    };

    // **avocados/olives** → **avocados**, **olives**
    let out = text.replace(/\*\*([^*]+)\*\*/g, (full, inner: string) => {
      if (!inner.includes('/') || inner.includes(',')) {
        return full;
      }
      const parts = inner.split('/').map((p) => p.trim()).filter(Boolean);
      return toCsv(parts) ? parts.map((p) => `**${p}**`).join(', ') : full;
    });

    // Plain avocados/olives → avocados, olives
    out = out.replace(
      /\b[A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*(?:\/[A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)+\b/g,
      (match) => {
        const parts = match.split('/').map((p) => p.trim()).filter(Boolean);
        return toCsv(parts) ?? match;
      }
    );

    return out;
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

  /** Full fact values plus useful CSV / phrase fragments (never slash compounds). */
  private expandFactPhrases(factValues: string[]): string[] {
    const phrases = new Set<string>();

    for (const value of factValues) {
      const trimmed = String(value || '').trim();
      if (trimmed.length >= 2) {
        phrases.add(trimmed);
      }

      // Split list values: "avocados, olives, pickled things"
      const parts = trimmed
        .split(/[/|,;()]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 3);

      for (const part of parts) {
        phrases.add(part);
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
