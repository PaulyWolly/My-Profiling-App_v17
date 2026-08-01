import { AiToolsStatus } from '../../services/ai-tools.service';

export type HelpTopic = 'chat' | 'describe' | 'generate' | 'rag';

export interface HelpSection {
  heading: string;
  items: string[];
}

export interface HelpGuide {
  title: string;
  intro: string;
  sections: HelpSection[];
  /** Rendered apart from the sections so limits stay easy to spot. */
  limits: string[];
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Builds the guide for one tool.
 *
 * Every number comes from the server's status response rather than being
 * written into the copy, because each limit is environment-configurable and
 * hardcoded text would silently go stale the moment one is changed.
 */
export function helpGuide(topic: HelpTopic, status: AiToolsStatus | null): HelpGuide {
  switch (topic) {
    case 'chat':
      return chatGuide(status);
    case 'describe':
      return describeGuide(status);
    case 'generate':
      return generateGuide(status);
    case 'rag':
      return ragGuide(status);
  }
}

function chatGuide(status: AiToolsStatus | null): HelpGuide {
  const maxMessages = status?.chatMaxMessages;
  const maxFacts = status?.memoryMaxFacts;
  const maxImages = status?.chatMaxImages;
  const voice = status?.ttsProvider === 'azure' ? 'a natural Azure voice' : 'a synthesized voice';

  const limits: string[] = [];
  if (maxMessages) {
    limits.push(`The most recent ${plural(maxMessages, 'message')} of your conversation are kept. Older turns drop off.`);
  }
  if (maxFacts) {
    limits.push(`Up to ${plural(maxFacts, 'detail')} about you are remembered at once.`);
  }
  if (maxImages) {
    limits.push(`A reply shows at most ${plural(maxImages, 'image')}.`);
  }
  limits.push('Chat itself is unlimited — ask as many questions as you like.');

  return {
    title: 'Chat',
    intro:
      'Ask anything. The assistant remembers details about you between visits, can look ' +
      'things up on the web, show pictures, and hold a spoken conversation.',
    sections: [
      {
        heading: 'Asking a question',
        items: [
          'Click "Ask your Query" to open a text box, type your question, and press Enter to send.',
          'Shift+Enter adds a new line instead of sending, for longer questions.',
          '"Clear Chat" empties the transcript but keeps what the assistant remembers about you.'
        ]
      },
      {
        heading: 'Talking instead of typing',
        items: [
          'Tick "Conversation Mode" to speak your questions and hear the answers read back in ' + voice + '.',
          'Your browser will ask for microphone permission the first time. It works best in Chrome or Edge.',
          'The assistant starts speaking as soon as the first sentence is ready, rather than waiting for the whole answer.',
          'After it finishes speaking it listens again automatically, so you can just keep talking.',
          'Untick the box at any time to go back to typing.'
        ]
      },
      {
        heading: 'When it searches the web',
        items: [
          'Most questions are answered from built-in knowledge, which is much faster.',
          'A live web search runs only when your wording implies current information — words like ' +
            '"today", "latest", "current", "news", "weather", "price", or "score".',
          'It also searches for subjects that change over time, such as who holds an office or who ' +
            'holds a record, even when you do not use one of those words.',
          'If an answer looks out of date, adding "right now" or "latest" to your question will force a fresh search.'
        ]
      },
      {
        heading: 'Getting pictures',
        items: [
          'Ask for "pictures of", "images of", or "photos of" something to get a grid of thumbnails.',
          'Click any thumbnail to see it full size, then use the arrows to move through the rest.',
          'The large view closes with the X or the Close button.'
        ]
      },
      {
        heading: 'What it remembers',
        items: [
          'Tell it your name, hobbies, or what you like and it will recall that on your next visit.',
          'The icon at the top right of the chat shows everything saved about you.',
          'You can delete any single detail from there, or use "Forget me" to erase all of them at once.'
        ]
      }
    ],
    limits
  };
}

function describeGuide(status: AiToolsStatus | null): HelpGuide {
  const maxMb = status?.imageUploadMaxMb;

  const limits: string[] = [];
  if (maxMb) {
    limits.push(`Images up to ${maxMb} MB.`);
  }
  limits.push('Common formats: JPG, PNG, GIF, WebP, BMP, and TIFF.');
  limits.push('No daily limit — describe as many images as you like.');

  return {
    title: 'Describe an Image',
    intro: 'Upload a picture and get a written description of what is in it.',
    sections: [
      {
        heading: 'How to use it',
        items: [
          'Choose an image from your device.',
          'Optionally type what you want to know about it — otherwise you get a general description.',
          'Click "Identify Image" and the description appears on the right.'
        ]
      },
      {
        heading: 'Getting better answers',
        items: [
          'A specific question gets a specific answer. "What breed is this dog?" beats "describe this".',
          'You can ask it to read text in the picture, identify objects, or judge the mood of a scene.',
          'Clear, well-lit pictures are read far more reliably than blurry or very dark ones.'
        ]
      }
    ],
    limits
  };
}

function generateGuide(status: AiToolsStatus | null): HelpGuide {
  const remaining = status?.imagesRemaining;
  const limit = status?.imageDailyLimit;

  const limits: string[] = [];
  if (remaining === null || remaining === undefined || !limit) {
    limits.push('No daily limit on your account.');
  } else {
    limits.push(`${plural(limit, 'image')} per day. You have ${remaining} left today.`);
    limits.push('The allowance resets at midnight UTC.');
    limits.push('Image generation is the most expensive feature here, which is why it is the only one with a daily cap.');
  }

  return {
    title: 'Generate an Image',
    intro: 'Describe a picture in words and have it created for you.',
    sections: [
      {
        heading: 'How to use it',
        items: [
          'Describe the image you want, then press Enter or click "Generate Image".',
          'Shift+Enter adds a new line if you want a longer description.',
          '"Use example" fills in a sample prompt so you can see the kind of detail that works well.',
          'Pick a size and quality before generating. HD takes longer but looks better.',
          'Use "Download PNG" to save the result — it is not stored for you.'
        ]
      },
      {
        heading: 'Writing a good prompt',
        items: [
          'Name the subject, the setting, and the lighting: "a red fox in snow at sunrise".',
          'Say what style you want — watercolour, oil painting, photograph, pencil sketch.',
          'Detail helps, but a very long prompt can pull the result in too many directions at once.',
          'Generating twice from the same prompt gives two different pictures, so try again if the first misses.'
        ]
      }
    ],
    limits
  };
}

function ragGuide(status: AiToolsStatus | null): HelpGuide {
  const maxMb = status?.ragMaxUploadMb;
  const maxChars = status?.ragMaxChars;

  const limits: string[] = [];
  if (maxMb) {
    limits.push(`Documents up to ${maxMb} MB each.`);
  }
  if (maxChars) {
    limits.push(`Up to ${maxChars.toLocaleString()} characters of text are read from each document.`);
  }
  limits.push('No limit on how many questions you ask.');

  return {
    title: 'Documents',
    intro:
      'Upload your own documents and ask questions that are answered from what is actually ' +
      'inside them, instead of from general knowledge.',
    sections: [
      {
        heading: 'How to use it',
        items: [
          'Upload a document and wait for it to finish indexing.',
          'Select which documents to search using the button at the start of each row.',
          '"All documents" selects or clears every document at once.',
          'Type your question and press Enter. Shift+Enter adds a new line.'
        ]
      },
      {
        heading: 'Reading the answer',
        items: [
          'Each answer is followed by the excerpts it was drawn from, so you can check it against the source.',
          'The answer comes only from your documents. If the text does not cover it, you will be told so rather than given a guess.',
          'Asking across several documents at once is useful for comparing them.'
        ]
      },
      {
        heading: 'Managing documents',
        items: [
          'The red trash icon deletes a document and everything indexed from it.',
          '"Reindex" re-reads a document, which is worth doing if a search stops finding things you expect.',
          'Text-based files work best. A scanned page with no text layer has nothing to read.'
        ]
      }
    ],
    limits
  };
}
