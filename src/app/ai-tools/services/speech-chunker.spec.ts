import {
  FIRST_CHUNK_CHARS,
  MAX_CHUNK_CHARS,
  NEXT_CHUNK_CHARS,
  nextSpeechChunk
} from './speech-chunker';

/** Feeds text through the chunker the way a streamed reply arrives. */
function chunkAll(text: string, step = 7): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (let i = 0; i < text.length; i += step) {
    buffer += text.slice(i, i + step);

    let result = nextSpeechChunk(buffer, chunks.length === 0, false);
    while (result.chunk) {
      chunks.push(result.chunk);
      buffer = result.rest;
      result = nextSpeechChunk(buffer, chunks.length === 0, false);
    }
    buffer = result.rest;
  }

  const last = nextSpeechChunk(buffer, chunks.length === 0, true);
  if (last.chunk) chunks.push(last.chunk);
  return chunks;
}

describe('nextSpeechChunk', () => {
  it('waits until there is enough text to be worth speaking', () => {
    const result = nextSpeechChunk('Hi there.', true, false);
    expect(result.chunk).toBeNull();
    expect(result.rest).toBe('Hi there.');
  });

  it('speaks whatever is left when the reply ends', () => {
    const result = nextSpeechChunk('Hi there.', true, true);
    expect(result.chunk).toBe('Hi there.');
    expect(result.rest).toBe('');
  });

  it('returns nothing for an empty flush rather than an empty request', () => {
    expect(nextSpeechChunk('   ', true, true).chunk).toBeNull();
  });

  it('cuts at the end of a sentence', () => {
    const text = `${'a'.repeat(FIRST_CHUNK_CHARS)} first sentence. Second sentence follows.`;
    const result = nextSpeechChunk(text, true, false);
    expect(result.chunk!.endsWith('first sentence.')).toBeTrue();
    expect(result.rest.trim()).toBe('Second sentence follows.');
  });

  it('does not split a decimal number', () => {
    const text = `${'a'.repeat(FIRST_CHUNK_CHARS)} the value is 3.5 and that is all we know here.`;
    const result = nextSpeechChunk(text, true, false);
    expect(result.chunk).toContain('3.5');
  });

  it('keeps the first piece short and later pieces longer', () => {
    const sentence = 'This is a sentence of a fairly ordinary length. ';
    const chunks = chunkAll(sentence.repeat(12));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThan(NEXT_CHUNK_CHARS);
    // Later pieces batch sentences together to avoid a request per sentence.
    expect(chunks[1].length).toBeGreaterThanOrEqual(NEXT_CHUNK_CHARS);
  });

  it('breaks a long run-on with no punctuation instead of staying silent', () => {
    const runOn = 'word '.repeat(200);
    const result = nextSpeechChunk(runOn, true, false);
    expect(result.chunk).not.toBeNull();
    expect(result.chunk!.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it('treats a line break as a sentence end, so list items are spoken', () => {
    const text = `${'a'.repeat(FIRST_CHUNK_CHARS)} item one\nitem two\n`;
    const result = nextSpeechChunk(text, true, false);
    expect(result.chunk!.endsWith('item one')).toBeTrue();
  });

  it('loses no text when a reply is streamed in small pieces', () => {
    const story = 'Once upon a time there was a small village. '
      + 'The village sat beside a wide river! '
      + 'Every morning the baker opened his shop. '
      + 'Was it the best bread in the land? '
      + 'Everyone agreed that it was.';

    for (const step of [1, 3, 7, 40]) {
      const joined = chunkAll(story, step).join(' ').replace(/\s+/g, ' ').trim();
      expect(joined).toBe(story.replace(/\s+/g, ' ').trim());
    }
  });

  it('speaks the first piece well before the whole reply has arrived', () => {
    const story = 'The sun rose over the hills. '.repeat(20);
    const firstAt = story.indexOf('.') + 1;
    const chunks = chunkAll(story);

    expect(chunks[0].length).toBeLessThanOrEqual(firstAt + FIRST_CHUNK_CHARS);
    expect(chunks[0].length).toBeLessThan(story.length / 4);
  });
});
