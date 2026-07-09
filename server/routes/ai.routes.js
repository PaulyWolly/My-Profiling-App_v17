const express = require('express');
const multer = require('multer');
const authorize = require('../_middleware/authenticate');
const db = require('../_helpers/db');
const openaiService = require('../services/openai.service');

const router = express.Router();

const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const DOCUMENT_MAX_MB = Math.max(1, parseInt(process.env.AI_RAG_MAX_UPLOAD_MB || '50', 10));
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

router.get('/status', (req, res) => {
    const chat = openaiService.getChatConfig();
    const imageGen = openaiService.getImageGenConfig();
    res.json({
        configured: !!openaiService.getApiKey(),
        transport: 'node-fetch',
        chatModel: chat.model,
        webSearch: chat.webSearch,
        ragMaxUploadMb: DOCUMENT_MAX_MB,
        imageGenModel: imageGen.model,
        imageGenSizes: imageGen.sizes,
        imageGenSupportsStyle: imageGen.supportsStyleParam
    });
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

        const reply = await openaiService.chat(sanitized);
        res.json({ reply });
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

        const result = await openaiService.generateImage(prompt, {
            size: req.body?.size,
            quality: req.body?.quality,
            style: req.body?.style
        });
        res.json(result);
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

        const doc = await db.AiDocument.create({
            accountId: req.user.id,
            filename: req.file.originalname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            charCount: ingested.text.length,
            chunkCount: ingested.chunks.length,
            embeddingModel: ingested.embeddingModel,
            chunks: ingested.chunks
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
