# Porting the AI limits, help, and document images to MERN-MultiChat

This describes four pieces of work done in My-Profiling-App and how to rebuild them in
MERN-MultiChat before it goes public on Render:

1. **Limits** — environment-driven caps, plus a per-user daily quota on image generation, the
   one call expensive enough to be worth metering.
2. **Help** — a `?` button on each AI tool that opens a guide whose numbers are read from the
   server, so the copy cannot drift from the configured limits.
3. **Document images** — showing the photographs that live inside an uploaded PDF or Word file
   alongside the answer drawn from them, instead of discarding them at upload.
4. **Dependency hygiene** — the checks that catch the class of failure that only appears on the
   host, after a build that succeeded.

The source implementation is Angular + Material; MERN-MultiChat is React 19 + Vite with
hand-written CSS. The **design** ports directly. The markup does not, so every UI snippet below
is already rewritten in that app's own idiom.

---

## The ideas worth keeping

Everything else is detail.

**One source of truth for every number.** No limit is ever typed into UI copy. The server owns
each value, publishes them all from a single `/status` endpoint, and the help text interpolates
what it receives. Change `AI_IMAGE_DAILY_LIMIT` on Render and the help dialog, the inline hints,
and the enforcement all move together. The alternative — writing "5 images per day" into a
paragraph — goes stale the first time you tune the value, and nobody notices for months.

**Charge before you spend.** The quota is claimed *before* the expensive call and refunded if it
fails. Checking first and incrementing after leaves a window where two simultaneous requests both
read "4 used" and both proceed. On a free Render instance with one process this feels unlikely,
right up until someone double-clicks Generate.

**Keep where something came from, not just what it was.** Extracting a document's pictures is
easy; knowing which page each one sat on is what makes them useful, because it is the only way to
show a question about one recipe the photographs of that recipe rather than all forty in the
file. The same instinct applies well beyond images — position and provenance are cheap to record
at ingest and impossible to recover afterwards.

---

## Part 1 — Limits

### 1.1 Make every limit an environment variable

None of these are hardcoded. Each is read once at module load with a default, so the app runs
with no configuration at all but every value is tunable from the Render dashboard.

```js
// Read once at module load. Math.max keeps a typo in the dashboard from
// producing a negative or zero cap that silently disables the feature.
const IMAGE_MAX_MB = Math.max(1, parseInt(process.env.AI_IMAGE_MAX_UPLOAD_MB || '50', 10));
```

The full set from the source app, with the defaults that proved workable:

| Variable | Default | Controls |
| --- | --- | --- |
| `AI_IMAGE_DAILY_LIMIT` | `5` | Generated images per user per day. `0` disables the cap |
| `AI_IMAGE_MAX_UPLOAD_MB` | `50` | Upload ceiling for image description |
| `AI_RAG_MAX_UPLOAD_MB` | `100` | Upload ceiling for RAG documents |
| `AI_RAG_MAX_CHARS` | `1500000` | Text extracted and indexed per document |
| `AI_CHAT_MAX_MESSAGES` | `100` | Conversation turns retained per user |
| `AI_MEMORY_MAX_FACTS` | `80` | Remembered facts retained per user |
| `AI_CHAT_MAX_IMAGES` | `8` | Image thumbnails returned per reply |
| `AI_RAG_MAX_IMAGES` | `24` | Pictures extracted and stored per document |

Only the first is a cost control. The rest are storage and payload guards — they stop one user's
200 MB PDF from becoming everyone's problem.

### 1.2 Publish them from `/status`

A single authenticated endpoint returns every limit alongside the caller's current standing. This
is what makes the help text self-updating, and it is the piece most worth copying exactly.

```js
router.get('/status', async (req, res, next) => {
    try {
        const imageUsage = await aiUsageService.getImageUsage(req.user);
        res.json({
            configured: openaiService.isConfigured(),
            imageDailyLimit: imageUsage.limit,
            // null rather than a number when the account has no cap, so the UI
            // can distinguish "unlimited" from "none left".
            imagesRemaining: imageUsage.unlimited ? null : imageUsage.remaining,
            imageUploadMaxMb: IMAGE_MAX_MB,
            ragMaxUploadMb: DOCUMENT_MAX_MB,
            ragMaxChars: openaiService.RAG_MAX_CHARS,
            chatMaxMessages: aiMemoryService.MAX_MESSAGES,
            memoryMaxFacts: aiMemoryService.MAX_FACTS,
            chatMaxImages: imageSearchService.MAX_IMAGES,
            ttsProvider: azureTtsService.isConfigured() ? 'azure' : 'openai'
        });
    } catch (err) {
        next(err);
    }
});
```

The `imagesRemaining: null` convention matters. Admins and users on an uncapped install need to
see "no daily limit", not "0 left" — a plain number cannot express both.

### 1.3 The daily quota

**The model.** One row per user per UTC day. It lives in Mongo rather than memory specifically
because Render restarts services and spins free instances down; an in-memory counter would reset
every allowance several times a day.

Written here in MERN-MultiChat's model style — banner comment, CommonJS, manual `created`/`updated`
rather than `timestamps: true`:

```js
/*
  AIUSAGE.JS
  AppName: MultiChat_Chatty
  Created by Paul Welby
*/

const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  // UTC calendar day, YYYY-MM-DD.
  day: { type: String, required: true },
  imagesGenerated: { type: Number, default: 0 },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// The quota claim upserts against this pair. The uniqueness is not incidental:
// it is what makes "already at the limit" detectable. See the service below.
aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true });

// Yesterday's counters have no value once the day rolls over.
aiUsageSchema.index({ updated: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
```

**The service.** This is the subtle part, so read the claim carefully.

```js
const AiUsage = require('../models/AiUsage');

const IMAGE_DAILY_LIMIT = Math.max(0, parseInt(process.env.AI_IMAGE_DAILY_LIMIT || '5', 10));

/** UTC so the reset time doesn't move with the server's locale. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function isExempt(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

/**
 * Claims one image generation against today's allowance.
 *
 * The count goes up before the image is generated, so two simultaneous requests
 * cannot both read "4 used" and each proceed. The filter only matches while the
 * user is under the limit; once they are not, the upsert has nothing to update
 * and tries to insert instead, which collides with the unique index. That
 * duplicate-key error is how exhaustion is detected.
 */
async function claimImageGeneration(user) {
  if (!IMAGE_DAILY_LIMIT || isExempt(user)) {
    return { allowed: true, used: 0, limit: 0, remaining: Infinity };
  }

  const userId = user.id;
  const day = today();

  try {
    const doc = await AiUsage.findOneAndUpdate(
      { userId, day, imagesGenerated: { $lt: IMAGE_DAILY_LIMIT } },
      { $inc: { imagesGenerated: 1 }, $set: { updated: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return {
      allowed: true,
      used: doc.imagesGenerated,
      limit: IMAGE_DAILY_LIMIT,
      remaining: Math.max(0, IMAGE_DAILY_LIMIT - doc.imagesGenerated)
    };
  } catch (err) {
    if (err?.code === 11000) {
      return { allowed: false, used: IMAGE_DAILY_LIMIT, limit: IMAGE_DAILY_LIMIT, remaining: 0 };
    }
    throw err;
  }
}

/** Hands back an allowance when the generation it was claimed for failed. */
async function releaseImageGeneration(user) {
  if (!IMAGE_DAILY_LIMIT || isExempt(user)) return;
  try {
    await AiUsage.updateOne(
      { userId: user.id, day: today(), imagesGenerated: { $gt: 0 } },
      { $inc: { imagesGenerated: -1 } }
    );
  } catch (err) {
    // A refund failure must never mask the original generation error.
    console.error('[AI] could not release image quota:', err?.message || err);
  }
}

/** Current standing, without consuming anything. Used by /status. */
async function getImageUsage(user) {
  if (!IMAGE_DAILY_LIMIT || isExempt(user)) {
    return { used: 0, limit: 0, remaining: Infinity, unlimited: true };
  }
  const doc = await AiUsage.findOne({ userId: user.id, day: today() });
  const used = doc?.imagesGenerated || 0;
  return {
    used,
    limit: IMAGE_DAILY_LIMIT,
    remaining: Math.max(0, IMAGE_DAILY_LIMIT - used),
    unlimited: false
  };
}

module.exports = { IMAGE_DAILY_LIMIT, claimImageGeneration, releaseImageGeneration, getImageUsage };
```

Three things that are easy to get wrong and are worth preserving:

- **The `$lt` in the filter is the enforcement.** It is not a validation step that happens to
  precede the update; the atomic operation *is* the check. Removing it reintroduces the race.
- **`isExempt` uses lowercase role strings** to match MERN-MultiChat's `'user' | 'admin' |
  'superadmin'` enum. The source app used a `Role` helper with capitalized values.
- **The TTL index** keeps the collection from growing forever without a cron job.

**Wiring it into the route.** Claim, generate, refund on failure:

```js
app.post('/api/images/generate', authenticateToken, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ success: false, message: 'prompt is required' });
  }

  const quota = await claimImageGeneration(req.user);
  if (!quota.allowed) {
    return res.status(429).json({
      success: false,
      message: `Daily image limit reached (${quota.limit} per day). More images unlock tomorrow.`
    });
  }

  try {
    const result = await generateImage(prompt, req.body);
    res.json({ success: true, ...result, imagesRemaining: quota.remaining, imagesLimit: quota.limit });
  } catch (err) {
    // The allowance was claimed up front to close the race between simultaneous
    // requests, so an unused one goes back.
    await releaseImageGeneration(req.user);
    res.status(500).json({ success: false, message: err.message });
  }
});
```

Returning `imagesRemaining` on the success response lets the UI update the counter without a
second round trip.

### 1.4 Three things specific to MERN-MultiChat

These are not refinements. Skip them and the quota does not work.

**The AI routes have no authentication.** `/api/chat`, `/api/tts`, `/api/analyze-image` and the
rest are declared without `authenticateToken`. The client sends a bearer token on every call, but
the server never checks it, so `req.user` is undefined and a per-user quota has nothing to key on.
**Add `authenticateToken` to every AI route before adding quotas.** Note this is a breaking change
for guest users: `/` and `/images` currently allow guests via `RequireAccess allowGuest`, so decide
deliberately whether guests lose image generation or get a separate shared allowance.

**Two identity systems.** `authenticateToken` sets `req.user.id` from the Mongo `_id`, but the data
models scope ownership with a loose `userId: String` fed by `getActiveDataKey()` from
`src/lib/authStorage.js`, which can be a guest key. The quota must key off `req.user.id` — the
authenticated identity — or a user clears their browser storage and gets a fresh allowance. That is
why the model above uses `userId: String` holding the account id rather than a `ref: 'User'`
ObjectId: it matches the app's existing convention while still being server-derived.

**The multer limit is 10 GB.** `server.js` has one global upload instance with
`limits: { fileSize: 10 * 1024 * 1024 * 1024 }`, commented as being for video files. That is
effectively no protection on an AI upload path. Create a *separate* multer instance for AI uploads
rather than lowering the shared one and breaking video:

```js
const aiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, parseInt(process.env.AI_IMAGE_MAX_UPLOAD_MB || '50', 10)) * 1024 * 1024 }
});
```

Also note `RagUploadPanel.jsx` enforces `MAX_BYTES = 50 * 1024 * 1024` in the browser only. Keep
that check for the fast friendly error, but it is not a limit until the server enforces it too.

---

## Part 2 — The help system

### 2.1 Content as data, not markup

The guide for each tool is a plain data structure produced by a function that takes the live status.
Keeping it separate from the component is what allows the numbers to come from the server, and it
means editing the wording never risks breaking the UI.

The source is TypeScript; here it is as plain JS for Vite:

```js
// src/lib/aiHelpContent.js

function plural(n, word) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Builds the guide for one tool.
 *
 * Every number comes from the server's status response rather than being written
 * into the copy, because each limit is environment-configurable and hardcoded
 * text would silently go stale the moment one is changed.
 */
export function helpGuide(topic, status) {
  switch (topic) {
    case 'chat': return chatGuide(status);
    case 'images': return generateGuide(status);
    case 'rag': return ragGuide(status);
    default: return { title: 'Help', intro: '', sections: [], limits: [] };
  }
}

function generateGuide(status) {
  const remaining = status?.imagesRemaining;
  const limit = status?.imageDailyLimit;

  const limits = [];
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
          'Pick a size and quality before generating. HD takes longer but looks better.',
          'Download the result to keep it — it is not stored for you.'
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
```

Note the `plural()` helper. It exists because `AI_IMAGE_DAILY_LIMIT=1` otherwise renders "1 images",
which looks broken in exactly the configuration a cost-conscious deploy is most likely to use.

The `limits` array is kept separate from `sections` so it can be rendered in its own highlighted
box. Users looking for "how many do I get" should not have to read prose to find it.

### 2.2 The dialog

Built on MERN-MultiChat's existing modal contract: controlled by an `open` prop, portalled to
`document.body`, dismissed only by the × or an explicit button — never an outside click — and
using the shared `ModalCloseButton`.

```jsx
// src/components/Shared/HelpModal/HelpModal.jsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ModalCloseButton from '../ModalCloseButton'
import { helpGuide } from '../../../lib/aiHelpContent'
import { getAiStatus } from '../../../api/client'

export default function HelpModal({ open, topic, status: passedStatus, onClose }) {
  const [status, setStatus] = useState(passedStatus ?? null)

  // The caller's status may predate the current allowance (an image could have
  // been generated since), so it is refreshed when the modal opens. A failure
  // is ignored: the guide reads correctly without live numbers.
  useEffect(() => {
    if (!open || passedStatus) return
    let cancelled = false
    getAiStatus()
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, passedStatus])

  if (!open) return null

  const guide = helpGuide(topic, status)

  return createPortal(
    <div className="help-modal-overlay">
      <div className="help-modal-container" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
        <div className="help-modal-header">
          <div>
            <h3 id="help-modal-title" className="help-modal-title">{guide.title}</h3>
            <span className="help-modal-sub">Help &amp; limits</span>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="help-modal-body">
          <p className="help-modal-intro">{guide.intro}</p>

          <section className="help-modal-limits">
            <h4 className="help-modal-limits-title">What you get</h4>
            <ul>
              {guide.limits.map((limit, i) => <li key={i}>{limit}</li>)}
            </ul>
          </section>

          {guide.sections.map(section => (
            <section className="help-modal-section" key={section.heading}>
              <h4 className="help-modal-section-title">{section.heading}</h4>
              <ul>
                {section.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <div className="help-modal-footer">
          <button type="button" className="confirm-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

### 2.3 The trigger

A small button the page owns, matching how `RagAskPanel` holds its own modal state:

```jsx
// src/components/Shared/HelpButton/HelpButton.jsx
import { useState } from 'react'
import HelpModal from '../HelpModal'

export default function HelpButton({ topic, status = null, label = 'Help and limits' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="help-button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
      >
        ?
      </button>
      <HelpModal open={open} topic={topic} status={status} onClose={() => setOpen(false)} />
    </>
  )
}
```

Drop it into each tool's page heading: `<HelpButton topic="images" status={status} />`.

Styles go in `src/App.css` alongside the existing feature-prefixed classes — there are no CSS
modules in this codebase and no utility framework, so a `help-modal-*` block matching the
`rag-answer-modal-*` conventions is the consistent choice.

### 2.4 Inline hints

The modal is for people who go looking. Most users do not, so the limits that prevent a failed
action should also appear next to that action, still driven by the same status object:

```jsx
<p className="hint">Documents up to {status?.ragMaxUploadMb ?? 100} MB.</p>
```

And where an allowance is nearly spent, say so where the button is, not only in the help:

```jsx
{status?.imagesRemaining !== null && status?.imagesRemaining !== undefined && (
  <p className="hint">{status.imagesRemaining} of {status.imageDailyLimit} images left today.</p>
)}
```

---

## Part 3 — Pictures from documents

RAG indexing normally keeps text and nothing else. A recipe PDF's photographs are dropped at
upload, so when a user asks for the recipe the answer can end with "Recipe Images" — the heading
that sat above the photos, which is text and therefore survived — and show nothing underneath.
The pictures were never missing from the display; they were never stored in the first place.

### 3.1 The idea that makes it useful

Extracting the images is the easy half. The half that decides whether the feature is any good is
**knowing where in the document each picture sat**.

Without that, a ten-recipe cookbook shows all forty of its photographs under every answer. With
it, asking about banana bread shows the banana bread photographs. So the pipeline tracks a page
number on two things: every chunk of text, and every extracted picture. An answer knows which
chunks it was built from, therefore which pages, therefore which pictures.

This is the whole design. Everything below is mechanism.

### 3.2 Reading a PDF

`pdf-parse` returns text only. Use `pdfjs-dist` instead, which gives text and images per page
from one pass.

The important detail: ask pdf.js for the **operator list** and pull images from `page.objs`,
rather than reading the PDF's raw image streams. A PDF may store an image as JPEG, Flate,
CCITT, JBIG2 and more. pdf.js has already decoded all of that by the time you see it, and hands
back plain pixels. Decoding the streams yourself means reimplementing every encoding the format
allows.

```js
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const doc = await pdfjs.getDocument({
  data: new Uint8Array(buffer),
  standardFontDataUrl: STANDARD_FONTS, // see the note below
  disableFontFace: true,
  isEvalSupported: false               // never hand eval a user upload
}).promise;

for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
  const page = await doc.getPage(pageNo);

  const content = await page.getTextContent();
  const text = content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  pages.push({ page: pageNo, text });

  const ops = await page.getOperatorList();
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const isImage = ops.fnArray[i] === pdfjs.OPS.paintImageXObject ||
                    ops.fnArray[i] === pdfjs.OPS.paintJpegXObject;
    if (!isImage) continue;

    const name = ops.argsArray[i][0];
    const img = await new Promise((resolve) => {
      // Page-scoped objects and objects shared between pages both occur.
      try { page.objs.get(name, resolve); } catch (e) { resolve(doc.commonObjs.get(name)); }
    });
    // img is { width, height, data } — raw pixels, ready for sharp.
  }

  page.cleanup();
}
```

Two traps worth knowing in advance:

**`standardFontDataUrl` must be a path, not a `file://` URL.** pdfjs fetches it, and Node's
`fetch` refuses the `file:` scheme. It also insists the value ends in a slash, which a Windows
path does not. Getting this wrong only produces a warning — but the failed font loads made
extraction **six times slower** in testing, so it is worth fixing rather than ignoring.

```js
const STANDARD_FONTS = `${path
  .join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
  .replace(/\\/g, '/')}/`;
```

**pdfjs is ESM only.** From CommonJS use a cached dynamic `import()`, as above.

### 3.3 Reading a Word file

`.docx` is a zip of XML, and `mammoth` reads both its text and its images with no native build,
which matters on Render. Convert to HTML rather than straight to text — only the HTML conversion
reports images, and it reports them *in place*, which is what preserves position.

The trick is to have each image leave a marker behind:

```js
const MARKER = (i) => `@@RAGIMG${i}@@`;

const result = await mammoth.convertToHtml({ buffer }, {
  convertImage: mammoth.images.imgElement(async (image) => {
    const index = collected.length;
    collected.push(image);
    return { src: MARKER(index) };
  })
});
```

**This is where I lost time, so take the warning.** The marker comes back inside an attribute —
`<img src="@@RAGIMG0@@">` — and the obvious next step, stripping tags with `/<[^>]+>/g`, deletes
the whole tag *including the marker inside it*. Every picture then appears to sit at character
zero, so they all land in the first section. Images still render, they are just quietly attached
to the wrong text, which is exactly the kind of bug that survives a casual look. Lift the markers
out of their tags before stripping anything:

```js
const IMG_TAG = /<img\b[^>]*>/gi;

function liftImageMarkers(html) {
  return html.replace(IMG_TAG, (tag) => {
    const marker = tag.match(/@@RAGIMG\d+@@/);
    return marker ? `\n${marker[0]}\n` : '';
  });
}
```

Then record each marker's offset in the plain text, remove the markers, and map offset to
section.

### 3.4 Word documents have no pages

This is a real constraint, not a detail to paper over. Pagination in a Word file is produced by
whatever renders it — it depends on paper size, installed fonts, even the printer driver. There
is no page number stored in the file to read.

So cut the text into sections of roughly a page of prose (3000 characters works, split on a
paragraph boundary where one is nearby) and number those. A picture takes the number of the
section it sits in. The page-association design then works unchanged.

Carry a `paginated: false` flag on such documents and **label the UI accordingly** — the source
app shows `part 2` for Word files and `p. 2` for PDFs. A badge claiming a page number the
document does not have is a small lie that will confuse someone eventually.

### 3.5 Where the images go

**Not in Mongo.** A document is capped at 16 MB there and the embeddings already occupy most of
that budget. The source app puts them in S3 and stores only the URL, page, and dimensions on the
document.

MERN-MultiChat may not have S3 wired up. In rough order of preference:

| Option | When it fits |
| --- | --- |
| S3 or any object store | Best. Bytes never touch your process on read |
| GridFS | Already have Mongo, no object store. Handles files past the 16 MB document cap |
| Render disk | Only with a persistent disk attached. The filesystem is otherwise ephemeral |

Whichever you choose, **do not fail the upload if image storage fails**. The text is what makes
a document answerable; the pictures enrich it. Log and carry on.

Normalize every image before storing it, whatever format it came from — this stops the stored
size depending on what the document happened to contain:

- **Skip the decoration.** Below 120 px on both edges, or under 40,000 pixels total, it is a
  bullet, a rule, or a logo.
- **Deduplicate by content hash.** A logo on all forty pages would otherwise be stored forty
  times and shown beside answers it has nothing to do with.
- **Downscale and re-encode** to JPEG at quality 82, max edge 1400.
- **Cap per document** (`AI_RAG_MAX_IMAGES`).

PDFs arrive as raw pixels and Word files as encoded files, so keep these rules in one shared
module rather than letting each format grow its own opinion.

### 3.6 Choosing what to show

Given the pages an answer cited, take the pictures on those pages. Then — and this is the part
that is easy to get wrong — **top up from neighbouring pages until you hit the display cap**.

The reason is specific and I only found it by testing a real file. A page can hold nothing but
photographs. It has no text, so it produces no chunks, so it can never be cited, so its pictures
can never be shown. In the banana bread PDF that was four of the ten photographs. An either/or
fallback ("use neighbours only if the cited pages have none") does not fix it, because the cited
page did have some.

```js
const take = (distance) => {
  for (const cited of citedPages) {
    const doc = byId.get(String(cited.documentId));
    if (!doc) continue;
    for (const image of doc.images || []) {
      if (Math.abs(image.page - cited.page) !== distance) continue;
      if (seen.has(image.url)) continue;
      seen.add(image.url);
      chosen.push({ /* url, page, pageLabel, dimensions, documentName */ });
      if (chosen.length >= MAX_ANSWER_IMAGES) return;
    }
  }
};

take(0); // on the cited pages
take(1); // then either side, which is where a text-free page of photos is caught
```

### 3.7 The React side

A thumbnail grid under the answer, each opening a lightbox. If MERN-MultiChat already has a
lightbox for chat images, reuse it rather than writing a second one.

```jsx
{images.length > 0 && (
  <div className="answer-images">
    <h4>Images from these pages</h4>
    <div className="image-grid">
      {images.map((img, i) => (
        <button
          key={img.url}
          type="button"
          className="image-thumb"
          onClick={() => setLightbox({ images, index: i })}
          aria-label={`View image from ${img.pageLabel || `page ${img.page}`}`}
        >
          <img src={img.url} alt={img.pageLabel || `Page ${img.page}`} loading="lazy" />
          <span className="image-page">{img.pageLabel || `p. ${img.page}`}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

```css
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}
.image-thumb {
  position: relative;
  padding: 0;
  border: 1px solid #d5e6f2;
  border-radius: 4px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  cursor: pointer;
}
.image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-page {
  position: absolute; right: .25rem; bottom: .25rem;
  padding: .1rem .35rem; border-radius: 3px;
  background: rgba(15, 23, 42, .75); color: #fff;
  font-size: .7rem; font-weight: 600;
}
```

**If the answer can also open in a modal, pass the images to it too.** The source app shipped
with the inline panel showing photographs and the "Expand" dialog silently dropping them,
because the dialog was written before answers carried images and nobody passed the new field
through. Anywhere an answer is rendered needs the images.

### 3.8 Things this changes that are easy to miss

- **Existing documents show nothing.** They were indexed without images and without page numbers
  on their chunks. They must be deleted and re-uploaded. Say so in the UI or the release note,
  or you will field the question.
- **Uploads get slower.** A 35 MB PDF took about 6.6 seconds to extract, before the images are
  stored. If the upload is synchronous, the user waits.
- **Storage and bandwidth grow.** That same PDF produced about 2.6 MB of stored images. Fine for
  recipes; worth a thought before someone uploads a photo book.
- **Legacy `.doc` is not worth supporting.** The binary Word 97–2003 format can be parsed for
  text, but not practically for images, so it would behave inconsistently with `.docx`. Reject it
  with a message telling the user to re-save as `.docx`.
- **Plain text formats can never do this.** `.txt`, `.csv`, and `.json` have nowhere to put an
  image. Markdown can only *reference* one, and a relative link points at a file the server never
  received. Only PDF and `.docx` genuinely carry pictures.

---

## Part 4 — Dependency hygiene

Two failures worth inoculating against, both of which cost a broken deploy in the source app.

### 4.1 Imports nothing declares

A package that is imported but not listed in `package.json` still works locally, because some
other dependency happens to install it. Nothing looks wrong until that other dependency is
removed or changes — and then it fails on the host, at startup, after a build that succeeded.

This is exactly what happened: removing an unused `sequelize` also removed `uuid`, which arrived
underneath it and which application code imported directly. Local tests passed because the
orphaned copy was still sitting in `node_modules`. Render installs from the lockfile into an
empty directory and got the truth: `MODULE_NOT_FOUND`, server down.

`server/scripts/dependency-check.js` in the source app scans every file for non-relative
`require()` and `import()`, and reports anything not declared or not resolvable. It is about a
hundred lines and ports directly — it only reads `package.json` and walks the source tree. **Run
it before any deploy that touches dependencies.** In MERN-MultiChat, run it once now: the same
exposure exists in any project that has been through a few dependency changes.

### 4.2 Audit noise hides real findings

The source app showed 24 advisories, which is enough that nobody reads them. Working through
them took it to zero, and the shape of the fix is instructive:

| Step | Effect |
| --- | --- |
| Removed three packages nothing imported | 24 → 20 |
| `npm audit fix` (non-breaking patches) | 20 → 4 |
| Two major bumps of packages actually used | 4 → 0 |

**Start by checking whether the flagged package is used at all.** Three of them — `sequelize`,
`mysql2`, `multer-s3` — appeared in zero files. `sequelize` was carrying the highest-severity
finding in the list, for an ORM the app had stopped using when it moved to MongoDB. Deleting
dead dependencies is the safest possible fix and it went first.

Two cautions from doing it:

**Check what you remove was not supplying something else.** See 4.1. Run the dependency check
immediately after any removal, and boot the server, not just the modules.

**Verify an auth library upgrade before trusting it.** Taking `bcrypt` from 5 to 6 clears a
critical advisory, and the hash format is unchanged so stored passwords still verify — but if
that had been wrong, every existing account would have been locked out and it would only have
shown up at the login screen, in production. `password-hash-compat-check.js` asserts it in one
process against a throwaway password: each library reads the other's hashes and the `$2b$`
format is intact. Cheap to run, and the failure it guards against is severe.

MERN-MultiChat hashes passwords too, so this check ports as-is and is worth having before any
`bcrypt` change.

---

## Suggested order of work

The dependencies run in one direction, so this sequence avoids rework:

1. **Extract the backend from `Node-AI-Project.zip`** and get it under source control. The archived
   snapshot predates the RAG and image-generation endpoints the React client already calls, so the
   server on disk cannot be the one running. Nothing below can be done accurately against a stale copy.
2. **Add `authenticateToken` to the AI routes.** Everything else depends on knowing who is calling.
   Decide the guest story here.
3. **Add the limit environment variables**, reading them at module load with defaults.
4. **Add the separate multer instance** for AI uploads.
5. **Add `/api/ai/status`** returning every limit. Verify with curl before touching the UI.
6. **Add the `AiUsage` model and service**, and wire claim/release into image generation.
7. **Add the help content module**, then the modal, then the button.
8. **Add the inline hints.**

Steps 1–2 are the real work. Once the server knows who is calling, the rest is mechanical.

Document images are independent of all of the above — they need no identity and no quota — so
they can be done at any point. Within that work the order does matter:

9. **Prove extraction on a real file first.** Point a script at an actual PDF and Word document
   and confirm pictures come out on the right pages before building anything on top. This is the
   only genuinely uncertain step; the rest follows from its output.
10. **Store page numbers on chunks**, chunking per page rather than across the whole document.
11. **Store the images** and record page, URL, and dimensions on the document.
12. **Return the cited pages** with the answer, then select images from them.
13. **Render the grid**, in every place an answer appears — including any modal.

Run `dependency-check.js` (Part 4) before the first deploy that includes new packages.

---

## Environment variables to add on Render

```
AI_IMAGE_DAILY_LIMIT=5
AI_IMAGE_MAX_UPLOAD_MB=50
AI_RAG_MAX_UPLOAD_MB=100
AI_RAG_MAX_CHARS=1500000
AI_RAG_MAX_IMAGES=24
```

All have code defaults, so the app boots without them. Set `AI_IMAGE_DAILY_LIMIT` deliberately —
it is the one that decides your monthly bill.

Document images also need wherever you chose to store them (Part 3.5) to be configured — object
store credentials, or nothing at all if you went with GridFS. And note `sharp` requires Node 20
or newer, so pin Node in the `package.json` that sits in the service's root directory.

If MERN-MultiChat is going onto Render too, the deployment notes in
[DEPLOY-RENDER-ALL.md](DEPLOY-RENDER-ALL.md) apply equally: the branch a service watches is fixed
at creation and drifts silently, and Node must be pinned in the `package.json` that sits in the
service's root directory.

---

## What deliberately did not get ported

For context on why the source app stops where it does:

- **No cap on chat, vision, or RAG questions.** They are cheap enough per call that metering them
  costs more in friction than it saves. Only generation is capped.
- **No global rate limiting.** Per-user daily quotas address cost. Burst protection is a different
  problem, and `express-rate-limit` in front of the AI routes would be the tool if abuse appears.
- **No usage dashboard.** The `AiUsage` collection is queryable directly, which was enough. The
  documents are already shaped for aggregation by day if that changes.
- **No page rendering for PDFs whose pictures cannot be extracted.** A PDF can draw a figure as
  vector art rather than embedding an image, and nothing can be pulled out of that. Rendering the
  whole page instead would cover it, but needs a native canvas library on the build, and real
  documents — recipes, reports, anything with photographs — embed ordinary raster images. The
  dependency was not worth adding for a case that has not come up. Check a real file before
  concluding you need it.
- **No text from scanned documents.** A scan is a picture of a page with no text layer, so there
  is nothing to index and the upload is rejected. OCR would solve it and is a project of its own.
