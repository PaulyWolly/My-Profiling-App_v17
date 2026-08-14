const express = require('express');
const multer = require('multer');
const authorize = require('../_middleware/authenticate');
const db = require('../_helpers/db');
const openaiService = require('../services/openai.service');
const azureTtsService = require('../services/azure-tts.service');
const aiMemoryService = require('../services/ai-memory.service');
const aiUsageService = require('../services/ai-usage.service');
const imageSearchService = require('../services/image-search.service');
const s3Service = require('../services/s3.service');

const router = express.Router();

// Larger uploads are accepted than the vision API takes inline; oversized
// images are resized before they are sent (see fitImageForVision).
const IMAGE_MAX_MB = Math.max(1, parseInt(process.env.AI_IMAGE_MAX_UPLOAD_MB || '50', 10));
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
const DOCUMENT_MAX_MB = Math.max(1, parseInt(process.env.AI_RAG_MAX_UPLOAD_MB || '100', 10));
const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;

const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES }
});

const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: DOCUMENT_MAX_BYTES }
});

function formatMaxSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
}

function multerSingle(uploadMiddleware, fieldName, maxBytes) {
    const maxLabel = formatMaxSize(maxBytes);
    return (req, res, next) => {
        uploadMiddleware.single(fieldName)(req, res, (err) => {
            if (!err) return next();
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    message: `File too large. Maximum upload size is ${maxLabel}.`
                });
            }
            return next(err);
        });
    };
}

function resolveImageMime(mimetype, originalname) {
    if (mimetype && mimetype.startsWith('image/')) {
        return mimetype;
    }
    const name = (originalname || '').toLowerCase();
    if (/\.(jpe?g|jfif|pjp)$/.test(name)) return 'image/jpeg';
    if (/\.png$/.test(name)) return 'image/png';
    if (/\.gif$/.test(name)) return 'image/gif';
    if (/\.webp$/.test(name)) return 'image/webp';
    if (/\.bmp$/.test(name)) return 'image/bmp';
    if (/\.tiff?$/.test(name)) return 'image/tiff';
    if (/\.svg$/.test(name)) return 'image/svg+xml';
    return null;
}

router.use(authorize());

router.get('/status', async (req, res, next) => {
    try {
        const chat = openaiService.getChatConfig();
        const imageGen = openaiService.getImageGenConfig();
        const azureTts = azureTtsService.isConfigured();
        const tts = azureTts ? azureTtsService.getTtsConfig() : openaiService.getTtsConfig();
        const facts = await aiMemoryService.getMemory(req.user.id);
        const imageUsage = await aiUsageService.getImageUsage(req.user);
        res.json({
            configured: !!openaiService.getApiKey(),
            transport: 'node-fetch',
            chatModel: chat.model,
            webSearch: chat.webSearch,
            ragMaxUploadMb: DOCUMENT_MAX_MB,
            imageGenModel: imageGen.model,
            imageGenSizes: imageGen.sizes,
            imageGenSupportsStyle: imageGen.supportsStyleParam,
            imageDailyLimit: imageUsage.limit,
            imagesRemaining: imageUsage.unlimited ? null : imageUsage.remaining,
            // Everything the in-app help shows, so its numbers follow the
            // server's env config instead of being duplicated in the UI copy.
            imageUploadMaxMb: IMAGE_MAX_MB,
            ragMaxChars: openaiService.RAG_MAX_CHARS,
            chatMaxMessages: aiMemoryService.MAX_MESSAGES,
            memoryMaxFacts: aiMemoryService.MAX_FACTS,
            chatMaxImages: imageSearchService.MAX_IMAGES,
            ttsVoices: tts.voices,
            ttsDefaultVoice: tts.defaultVoice,
            ttsProvider: azureTts ? 'azure' : 'openai',
            memoryFactCount: facts.length
        });
    } catch (err) {
        next(err);
    }
});

router.get('/conversations', async (req, res, next) => {
    try {
        const conversations = await aiMemoryService.listConversations(req.user.id);
        res.json({ conversations });
    } catch (err) {
        next(err);
    }
});

router.get('/conversations/:id', async (req, res, next) => {
    try {
        const convo = await aiMemoryService.getConversation(req.user.id, req.params.id);
        if (!convo.id) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        res.json({
            id: convo.id,
            title: convo.title,
            messages: (convo.messages || []).map((m) => ({
                role: m.role,
                content: m.content,
                createdAt: m.createdAt
            }))
        });
    } catch (err) {
        next(err);
    }
});

router.delete('/conversations/:id', async (req, res, next) => {
    try {
        const removed = await aiMemoryService.deleteConversation(req.user.id, req.params.id);
        if (!removed) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        res.json({ message: 'Conversation deleted' });
    } catch (err) {
        next(err);
    }
});

router.get('/conversation', async (req, res, next) => {
    try {
        const convo = await aiMemoryService.getConversation(req.user.id);
        res.json({
            id: convo.id || '',
            title: convo.title || 'New chat',
            messages: (convo.messages || []).map((m) => ({
                role: m.role,
                content: m.content,
                createdAt: m.createdAt
            }))
        });
    } catch (err) {
        next(err);
    }
});

router.delete('/conversation', async (req, res, next) => {
    try {
        await aiMemoryService.clearConversation(req.user.id);
        res.json({ message: 'Conversation history cleared' });
    } catch (err) {
        next(err);
    }
});

router.get('/memory', async (req, res, next) => {
    try {
        const facts = await aiMemoryService.getMemory(req.user.id);
        res.json({ facts });
    } catch (err) {
        next(err);
    }
});

router.delete('/memory', async (req, res, next) => {
    try {
        await aiMemoryService.clearMemory(req.user.id);
        res.json({ message: 'Long-term memory cleared' });
    } catch (err) {
        next(err);
    }
});

router.delete('/memory/:key', async (req, res, next) => {
    try {
        const facts = await aiMemoryService.deleteMemoryFact(req.user.id, req.params.key);
        res.json({ facts });
    } catch (err) {
        next(err);
    }
});

router.post('/chat', async (req, res, next) => {
    try {
        const messages = req.body?.messages;
        if (!Array.isArray(messages) || !messages.length) {
            return res.status(400).json({ message: 'messages array is required' });
        }

        const sanitized = messages
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
            .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 8000) }));

        if (!sanitized.length) {
            return res.status(400).json({ message: 'No valid messages provided' });
        }

        const lastUser = [...sanitized].reverse().find((m) => m.role === 'user');
        if (!lastUser) {
            return res.status(400).json({ message: 'A user message is required' });
        }

        const facts = await aiMemoryService.getMemory(req.user.id);
        const memorySystemContent = aiMemoryService.formatFactsForPrompt(facts);

        const wantsImages = imageSearchService.wantsImages(lastUser.content);
        const textMessages = wantsImages
            ? imageSearchService.hideImageRequestFromMessages(sanitized)
            : sanitized;

        // The model only sees the text question. Pictures are attached afterward.
        let replyText = await openaiService.chat(textMessages, { memorySystemContent });
        if (wantsImages) {
            replyText = imageSearchService.stripModelImageMentions(replyText);
        }

        let imageResult = { wanted: false, images: [], markdown: '' };
        if (wantsImages) {
            imageResult = await imageSearchService.fetchImagesForChat(lastUser.content, replyText);
        }

        let reply = replyText;
        if (imageResult.wanted && imageResult.markdown) {
            reply = `${replyText}${imageResult.markdown}`;
        }

        const saved = await aiMemoryService.appendConversation(
            req.user.id,
            lastUser.content,
            reply,
            req.body?.conversationId
        );

        res.json({
            reply,
            memoryFactCount: facts.length,
            images: imageResult.images || [],
            // The subject the pictures were found under, so "more images" asks
            // for the same thing without re-deriving it from the conversation.
            imageQuery: imageResult.query || '',
            conversationId: saved.id
        });

        // Fact extraction is a second model call that adds a few seconds to every
        // turn, and the browser does not need its result to show the reply, so it
        // runs after the response. The client re-reads memory when it needs it.
        aiMemoryService
            .extractAndStoreFacts(req.user.id, lastUser.content, replyText)
            .catch((memErr) => console.warn('[AI] Memory update failed:', memErr?.message || memErr));
    } catch (err) {
        next(err);
    }
});

/**
 * Same turn as POST /chat, but the reply is written out as it is generated so
 * the browser can show text immediately instead of waiting on a slow search.
 *
 * The body is newline-delimited JSON, one event per line:
 *   {"type":"status","value":"searching"|"writing"}
 *   {"type":"delta","value":"next piece of text"}
 *   {"type":"rewrite","value":"reply with image chatter removed"}
 *   {"type":"images","value":[...],"query":"what they were found under"}
 *   {"type":"done","reply":"...","memoryFactCount":N}
 *   {"type":"error","message":"..."}
 */
router.post('/chat/stream', async (req, res) => {
    // When the first text left the server. A model that thinks before writing
    // emits everything in a burst at the end, which limits how early the reply
    // can start being read aloud.
    let firstTextAt = null;

    const send = (event) => {
        if (event.type === 'delta' && firstTextAt === null) {
            firstTextAt = Date.now();
        }
        if (!res.writableEnded) {
            res.write(`${JSON.stringify(event)}\n`);
        }
    };

    try {
        const messages = req.body?.messages;
        if (!Array.isArray(messages) || !messages.length) {
            return res.status(400).json({ message: 'messages array is required' });
        }

        const sanitized = messages
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
            .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 8000) }));

        if (!sanitized.length) {
            return res.status(400).json({ message: 'No valid messages provided' });
        }

        const lastUser = [...sanitized].reverse().find((m) => m.role === 'user');
        if (!lastUser) {
            return res.status(400).json({ message: 'A user message is required' });
        }

        // Nothing may be written before this point or the status code is locked in.
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no'); // keep proxies from holding chunks back
        res.flushHeaders();

        // A client that navigates away should not leave the model call running.
        let aborted = false;
        req.on('aborted', () => { aborted = true; });

        const startedAt = Date.now();
        const facts = await aiMemoryService.getMemory(req.user.id);
        const memoryMs = Date.now() - startedAt;

        const memorySystemContent = aiMemoryService.formatFactsForPrompt(facts);
        const wantsImages = imageSearchService.wantsImages(lastUser.content);
        const textMessages = wantsImages
            ? imageSearchService.hideImageRequestFromMessages(sanitized)
            : sanitized;

        const replyAt = Date.now();
        let replyText = await openaiService.chatStream(textMessages, { memorySystemContent }, send);
        const replyMs = Date.now() - replyAt;

        if (aborted) {
            return;
        }

        if (wantsImages) {
            const cleaned = imageSearchService.stripModelImageMentions(replyText);
            if (cleaned !== replyText) {
                send({ type: 'rewrite', value: cleaned });
                replyText = cleaned;
            }
        }

        const imagesAt = Date.now();
        let imageResult = { wanted: false, images: [], markdown: '' };
        if (wantsImages) {
            send({ type: 'status', value: 'images' });
            imageResult = await imageSearchService.fetchImagesForChat(lastUser.content, replyText);
        }
        const imagesMs = Date.now() - imagesAt;

        let reply = replyText;
        if (imageResult.wanted && imageResult.markdown) {
            reply = `${replyText}${imageResult.markdown}`;
        }

        if (imageResult.images?.length) {
            send({ type: 'images', value: imageResult.images, query: imageResult.query || '' });
        }

        let conversationId = String(req.body?.conversationId || '').trim();
        try {
            const saved = await aiMemoryService.appendConversation(
                req.user.id,
                lastUser.content,
                reply,
                conversationId
            );
            conversationId = saved.id;
        } catch (saveErr) {
            console.warn('[AI] Conversation save failed:', saveErr?.message || saveErr);
        }

        // The full reply is repeated here so the client can settle on one final
        // string rather than trusting its own reassembly of the deltas.
        send({ type: 'done', reply, memoryFactCount: facts.length, conversationId });
        res.end();

        console.log(
            `[AI] chat turn: memory ${memoryMs}ms` +
            `, first text ${firstTextAt ? firstTextAt - replyAt : '-'}ms` +
            `, reply ${replyMs}ms` +
            `${wantsImages ? `, images ${imagesMs}ms` : ''}` +
            `, total ${Date.now() - startedAt}ms`
        );

        aiMemoryService
            .extractAndStoreFacts(req.user.id, lastUser.content, replyText)
            .catch((memErr) => console.warn('[AI] Memory update failed:', memErr?.message || memErr));
    } catch (err) {
        console.error('[AI] chat stream failed:', err?.message || err);
        const message = typeof err === 'string' ? err : (err?.message || 'Chat failed. Please try again.');

        // Once the stream has started the status code is already sent, so the
        // failure has to travel as an event instead of an HTTP error.
        if (res.headersSent) {
            send({ type: 'error', message });
            res.end();
        } else {
            res.status(500).json({ message });
        }
    }
});

/**
 * A chat turn with a picture attached. Multipart rather than JSON because the
 * image travels with it, and unstreamed because the vision model returns the
 * whole answer at once.
 */
router.post('/chat/vision', multerSingle(imageUpload, 'image', IMAGE_MAX_BYTES), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'image file is required' });
        }

        const mimeType = resolveImageMime(req.file.mimetype, req.file.originalname);
        if (!mimeType) {
            return res.status(400).json({ message: 'File must be an image' });
        }

        // The conversation arrives as a JSON string, since multipart bodies
        // carry text fields rather than structured data.
        let messages;
        try {
            messages = JSON.parse(req.body?.messages || '[]');
        } catch {
            return res.status(400).json({ message: 'messages must be valid JSON' });
        }

        const sanitized = (Array.isArray(messages) ? messages : [])
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
            .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 8000) }));

        if (!sanitized.some((m) => m.role === 'user')) {
            return res.status(400).json({ message: 'A user message is required' });
        }

        const facts = await aiMemoryService.getMemory(req.user.id);
        const memorySystemContent = aiMemoryService.formatFactsForPrompt(facts);

        const reply = await openaiService.chatAboutImage(sanitized, req.file.buffer, mimeType, {
            memorySystemContent
        });

        const lastUser = [...sanitized].reverse().find((m) => m.role === 'user');
        const asked = lastUser?.content?.trim() || '[sent a picture]';
        const saved = await aiMemoryService.appendConversation(
            req.user.id,
            asked,
            reply,
            req.body?.conversationId
        );

        res.json({ reply, memoryFactCount: facts.length, conversationId: saved.id });

        aiMemoryService
            .extractAndStoreFacts(req.user.id, asked, reply)
            .catch((memErr) => console.warn('[AI] Memory update failed:', memErr?.message || memErr));
    } catch (err) {
        next(err);
    }
});

/**
 * A further page of pictures for a subject already answered. No model call is
 * involved — this only searches — so it costs nothing against the AI quotas.
 */
router.post('/chat/images/more', async (req, res, next) => {
    try {
        const query = String(req.body?.query || '').trim();
        if (!query) {
            return res.status(400).json({ message: 'query is required' });
        }

        const exclude = Array.isArray(req.body?.exclude)
            ? req.body.exclude.filter((url) => typeof url === 'string').slice(0, 200)
            : [];

        const result = await imageSearchService.fetchMoreImages(query, { exclude });
        res.json({ images: result.images || [] });
    } catch (err) {
        next(err);
    }
});

router.post('/describe-image', multerSingle(imageUpload, 'image', IMAGE_MAX_BYTES), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'image file is required' });
        }
        const mimeType = resolveImageMime(req.file.mimetype, req.file.originalname);
        if (!mimeType) {
            return res.status(400).json({ message: 'File must be an image' });
        }

        const description = await openaiService.describeImage(
            req.file.buffer,
            mimeType,
            req.body?.prompt
        );
        res.json({ description });
    } catch (err) {
        next(err);
    }
});

router.post('/generate-image', async (req, res, next) => {
    try {
        const prompt = String(req.body?.prompt || '').trim();
        if (!prompt) {
            return res.status(400).json({ message: 'prompt is required' });
        }

        const quota = await aiUsageService.claimImageGeneration(req.user);
        if (!quota.allowed) {
            return res.status(429).json({
                message: `Daily image limit reached (${quota.limit} per day). More images unlock tomorrow.`
            });
        }

        let result;
        try {
            result = await openaiService.generateImage(prompt, {
                size: req.body?.size,
                quality: req.body?.quality,
                style: req.body?.style
            });
        } catch (err) {
            // The allowance was claimed up front to close the race between
            // simultaneous requests, so an unused one goes back.
            await aiUsageService.releaseImageGeneration(req.user);
            throw err;
        }

        res.json({ ...result, imagesRemaining: quota.remaining, imagesLimit: quota.limit });
    } catch (err) {
        next(err);
    }
});

router.post('/tts', async (req, res, next) => {
    try {
        const text = String(req.body?.text || '').trim();
        if (!text) {
            return res.status(400).json({ message: 'text is required' });
        }

        // Azure owns speech when it has credentials; OpenAI is the fallback.
        const provider = azureTtsService.isConfigured() ? azureTtsService : openaiService;
        const startedAt = Date.now();
        const { buffer, model, voice } = await provider.synthesizeSpeech(text, req.body?.voice);
        console.log(`[AI] tts: ${text.length} chars in ${Date.now() - startedAt}ms`);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-store',
            'X-TTS-Model': model,
            'X-TTS-Voice': voice
        });
        res.send(buffer);
    } catch (err) {
        next(err);
    }
});

router.get('/documents', async (req, res, next) => {
    try {
        const docs = await db.AiDocument.find({ accountId: req.user.id })
            .sort({ uploaded: -1 })
            .select('-chunks');
        res.json(docs);
    } catch (err) {
        next(err);
    }
});

/**
 * Puts a document's pictures in S3 and returns what to record against it.
 *
 * They are stored outside Mongo because a document is capped at 16MB there and
 * the embeddings already take most of that. A failure to store one is not worth
 * failing the upload over: the text is what makes the document answerable, and
 * the pictures only enrich it.
 */
async function storeDocumentImages(accountId, images) {
    if (!images || !images.length) return [];

    const stored = [];
    for (let i = 0; i < images.length; i += 1) {
        const image = images[i];
        try {
            const name = `rag-${accountId}-${Date.now()}-p${image.page}-${i}.jpg`;
            const url = await s3Service.uploadFile(image.buffer, name, image.contentType, 'rag-images');
            stored.push({ page: image.page, url, width: image.width, height: image.height });
        } catch (err) {
            console.warn(`[AI] rag: could not store page ${image.page} image —`, err.message || err);
        }
    }

    console.log(`[AI] rag: stored ${stored.length} of ${images.length} document image(s)`);
    return stored;
}

/** Matches the thumbnail grid the chat already uses. */
const MAX_ANSWER_IMAGES = 8;

/**
 * The pictures worth showing beside an answer.
 *
 * Scoped to the pages the answer was built from, so asking about one recipe does
 * not surface the photos from every other recipe in the file. Pages either side
 * are then used to fill any room left over, because a page can hold nothing but
 * photographs: with no text on it there is no chunk to match a question against,
 * so it can never be cited on its own and its pictures would never be seen.
 */
function collectAnswerImages(docs, citedPages) {
    if (!citedPages || !citedPages.length) return [];

    const byId = new Map(docs.map((doc) => [String(doc.id), doc]));
    const chosen = [];
    const seen = new Set();

    const take = (distance) => {
        for (const cited of citedPages) {
            const doc = byId.get(String(cited.documentId));
            if (!doc) continue;

            for (const image of doc.images || []) {
                if (Math.abs(image.page - cited.page) !== distance) continue;
                if (seen.has(image.url)) continue;
                seen.add(image.url);
                chosen.push({
                    url: image.url,
                    page: image.page,
                    // A Word file is cut into sections rather than paginated, so
                    // its numbering is labelled for what it is.
                    pageLabel: doc.paginated === false ? `part ${image.page}` : `p. ${image.page}`,
                    width: image.width,
                    height: image.height,
                    documentName: doc.originalName
                });
                if (chosen.length >= MAX_ANSWER_IMAGES) return;
            }
        }
    };

    take(0);
    take(1);
    return chosen;
}

router.post('/documents', multerSingle(documentUpload, 'document', DOCUMENT_MAX_BYTES), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'document file is required' });
        }

        const ingested = await openaiService.ingestDocument(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        const images = await storeDocumentImages(req.user.id, ingested.images);

        const doc = await db.AiDocument.create({
            accountId: req.user.id,
            filename: req.file.originalname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            charCount: ingested.text.length,
            chunkCount: ingested.chunks.length,
            embeddingModel: ingested.embeddingModel,
            chunks: ingested.chunks,
            images,
            paginated: ingested.paginated !== false
        });

        res.json(doc);
    } catch (err) {
        next(err);
    }
});

router.delete('/documents/:id', async (req, res, next) => {
    try {
        const doc = await db.AiDocument.findOneAndDelete({
            _id: req.params.id,
            accountId: req.user.id
        });
        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }
        res.json({ message: 'Document deleted' });
    } catch (err) {
        next(err);
    }
});

router.post('/documents/ask', async (req, res, next) => {
    try {
        const question = String(req.body?.question || '').trim();
        if (!question) {
            return res.status(400).json({ message: 'question is required' });
        }

        const ids = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
        if (!ids.length) {
            return res.status(400).json({ message: 'documentIds must contain at least one document' });
        }

        const docs = await db.AiDocument.find({
            _id: { $in: ids },
            accountId: req.user.id
        });
        if (!docs.length) {
            return res.status(404).json({ message: 'No matching documents found' });
        }

        const result = await openaiService.askDocuments(
            docs.map((doc) => ({
                id: doc.id,
                name: doc.originalName,
                chunks: doc.chunks,
                embeddingModel: doc.embeddingModel
            })),
            question
        );

        res.json({
            answer: result.answer,
            sources: result.sources,
            images: collectAnswerImages(docs, result.citedPages),
            documentNames: docs.map((doc) => doc.originalName)
        });
    } catch (err) {
        next(err);
    }
});

router.post('/documents/:id/reindex', async (req, res, next) => {
    try {
        const doc = await db.AiDocument.findOne({
            _id: req.params.id,
            accountId: req.user.id
        });
        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const result = await openaiService.reindexDocument(doc.chunks);
        doc.embeddingModel = result.embeddingModel;
        doc.chunks = result.chunks;
        doc.chunkCount = result.chunks.length;
        await doc.save();

        res.json(doc);
    } catch (err) {
        next(err);
    }
});

router.post('/documents/:id/ask', async (req, res, next) => {
    try {
        const question = String(req.body?.question || '').trim();
        if (!question) {
            return res.status(400).json({ message: 'question is required' });
        }

        const doc = await db.AiDocument.findOne({
            _id: req.params.id,
            accountId: req.user.id
        });
        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const result = await openaiService.askDocument(doc.chunks, question, doc.embeddingModel);
        res.json({
            answer: result.answer,
            sources: result.sources,
            documentName: doc.originalName
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
