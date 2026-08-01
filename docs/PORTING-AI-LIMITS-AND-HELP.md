# Porting the AI limits and in-app help to MERN-MultiChat

This describes two subsystems built in My-Profiling-App and how to rebuild them in
MERN-MultiChat before it goes public on Render:

1. **Limits** — environment-driven caps, plus a per-user daily quota on image generation, the
   one call expensive enough to be worth metering.
2. **Help** — a `?` button on each AI tool that opens a guide whose numbers are read from the
   server, so the copy cannot drift from the configured limits.

The source implementation is Angular + Material; MERN-MultiChat is React 19 + Vite with
hand-written CSS. The **design** ports directly. The markup does not, so every UI snippet below
is already rewritten in that app's own idiom.

---

## The two ideas worth keeping

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

---

## Environment variables to add on Render

```
AI_IMAGE_DAILY_LIMIT=5
AI_IMAGE_MAX_UPLOAD_MB=50
AI_RAG_MAX_UPLOAD_MB=100
AI_RAG_MAX_CHARS=1500000
```

All have code defaults, so the app boots without them. Set `AI_IMAGE_DAILY_LIMIT` deliberately —
it is the one that decides your monthly bill.

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
