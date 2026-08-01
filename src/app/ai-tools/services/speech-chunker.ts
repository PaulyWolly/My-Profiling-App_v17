/**
 * Cuts a reply into pieces that can be spoken while the rest is still being
 * written.
 *
 * The trade-off is size against delay: every piece costs a synthesis round
 * trip, but waiting for a large one keeps the speaker silent. So the first
 * piece is deliberately short to get audio started, and later pieces are longer
 * to keep the audio continuous.
 */

/** Short first piece so speech starts quickly, longer ones after that. */
export const FIRST_CHUNK_CHARS = 40;
export const NEXT_CHUNK_CHARS = 180;
/** Cut here even without punctuation, so speech never stalls on a long run-on. */
export const MAX_CHUNK_CHARS = 400;

export interface SpeechChunk {
  /** Text ready to speak, or null when more should be buffered first. */
  chunk: string | null;
  /** What is left over, to be carried into the next call. */
  rest: string;
}

/** Index just past the first sentence ending at or after `from`. */
function sentenceEnd(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') {
      return i + 1;
    }
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      const next = text[i + 1];
      // A boundary needs whitespace or a closing quote after it, so decimals
      // and abbreviations like "3.5" or "e.g." do not split a sentence.
      if (next === undefined || next === ' ' || next === '\n' || next === '"' || next === '”') {
        return i + 1;
      }
    }
  }
  return -1;
}

/**
 * @param buffer text received but not yet spoken
 * @param isFirst whether this would be the first piece of the reply
 * @param flush true when no more text is coming, so speak whatever is left
 */
export function nextSpeechChunk(buffer: string, isFirst: boolean, flush: boolean): SpeechChunk {
  if (flush) {
    return { chunk: buffer.trim() || null, rest: '' };
  }

  const minimum = isFirst ? FIRST_CHUNK_CHARS : NEXT_CHUNK_CHARS;
  if (buffer.length < minimum) {
    return { chunk: null, rest: buffer };
  }

  let cut = sentenceEnd(buffer, minimum);

  if (cut < 0) {
    // No punctuation in sight. Keep waiting unless the run-on is long enough
    // that staying silent would be worse than breaking at a word.
    if (buffer.length < MAX_CHUNK_CHARS) {
      return { chunk: null, rest: buffer };
    }
    cut = buffer.lastIndexOf(' ', MAX_CHUNK_CHARS);
    if (cut < minimum) {
      cut = MAX_CHUNK_CHARS;
    }
  }

  const chunk = buffer.slice(0, cut).trim();
  return { chunk: chunk || null, rest: buffer.slice(cut) };
}
