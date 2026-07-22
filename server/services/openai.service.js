const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const nodeFetch = require('node-fetch');

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-nano';
const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5-nano';
const CHAT_SEARCH_MODELS = [
    'gpt-5-search-api',
    process.env.OPENAI_CHAT_SEARCH_MODEL || 'gpt-4o-mini-search-preview',
    'gpt-4o-search-preview'
].filter((value, index, all) => all.indexOf(value) === index);
const CHAT_WEB_SEARCH = process.env.OPENAI_CHAT_WEB_SEARCH !== 'false';
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'low';
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const IMAGE_GEN_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const IMAGE_GEN_MODEL_CANDIDATES = [
    process.env.OPENAI_IMAGE_MODEL,
    'gpt-image-1',
    'gpt-image-1-mini'
].filter((value, index, all) => value && all.indexOf(value) === index);
const DALLE3_SIZES = new Set(['1024x1024', '1792x1024', '1024x1792']);
const DALLE2_SIZES = new Set(['256x256', '512x512', '1024x1024']);
const GPT_IMAGE_SIZES = new Set(['1024x1024', '1536x1024', '1024x1536', 'auto']);
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002';
const EMBEDDING_MODEL_CANDIDATES = [
    process.env.OPENAI_EMBEDDING_MODEL,
    EMBEDDING_MODEL,
    'text-embedding-ada-002',
    'text-embedding-3-small',
    'text-embedding-3-large'
].filter((value, index, all) => value && all.indexOf(value) === index);
const EMBEDDING_BATCH_SIZE = 100;
const KEYWORD_RAG_MODEL = 'keyword-search';

let activeEmbeddingModel = null;
let activeImageGenModel = null;

/** node-fetch + fresh connections — fixes "Premature close" on some Windows/VPN networks */
const openAiHttpsAgent = new https.Agent({
    keepAlive: false,
    family: 4,
    timeout: 120_000
});

function openAiFetch(url, init = {}) {
    return nodeFetch(url, {
        ...init,
        agent: openAiHttpsAgent,
        timeout: 120_000,
        compress: true
    });
}

console.log('[OpenAI] Using node-fetch transport (keepAlive: false, IPv4)');
console.log(`[OpenAI] Chat: ${CHAT_WEB_SEARCH ? `${RESPONSES_MODEL} + web search` : CHAT_MODEL}`);
console.log(`[OpenAI] RAG embeddings: ${EMBEDDING_MODEL_CANDIDATES.join(' → ')}`);
console.log(`[OpenAI] Image generation: ${IMAGE_GEN_MODEL_CANDIDATES.join(' → ')}`);

function isTransientOpenAiError(err) {
    const msg = formatOpenAiError(err).toLowerCase();
    return /premature close|econnreset|etimedout|socket hang up|fetch failed|network|timeout|aborted/.test(msg);
}

function getApiKey() {
    if (process.env.OPENAI_API_KEY?.trim()) {
        return process.env.OPENAI_API_KEY.trim();
    }
    try {
        const configPath = path.join(__dirname, '..', 'secrets', 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return (config.openAiApiKey || '').trim();
    } catch (e) {
        return '';
    }
}

function formatOpenAiError(err) {
    if (typeof err === 'string') return err;
    if (err?.error?.message) return err.error.message;
    if (err?.message) return err.message;
    return 'OpenAI request failed';
}

async function withOpenAiError(label, fn) {
    const maxAttempts = 5;
    let lastErr;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const msg = formatOpenAiError(err);
            if (attempt < maxAttempts && isTransientOpenAiError(err)) {
                console.warn(`[OpenAI] ${label} transient error (attempt ${attempt}/${maxAttempts}):`, msg);
                await new Promise((r) => setTimeout(r, 1000 * attempt));
                continue;
            }
            console.error(`[OpenAI] ${label} error:`, err);
            throw msg;
        }
    }

    throw formatOpenAiError(lastErr);
}

function getClient() {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw 'OpenAI API key not configured. Set OPENAI_API_KEY (Render) or openAiApiKey in server/secrets/config.json (local).';
    }

    return new OpenAI({
        apiKey,
        timeout: 120_000,
        maxRetries: 0,
        fetch: openAiFetch
    });
}

function chunkText(text, size = 1200, overlap = 200) {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
        const end = Math.min(start + size, normalized.length);
        const piece = normalized.slice(start, end).trim();
        if (piece) chunks.push(piece);
        if (end >= normalized.length) break;
        start = end - overlap;
    }
    return chunks;
}

function cosineSimilarity(a, b) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

async function extractTextFromFile(buffer, mimeType, originalName) {
    const lower = (originalName || '').toLowerCase();

    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text || '';
    }

    if (
        mimeType?.startsWith('text/') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.md') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.json')
    ) {
        return buffer.toString('utf8');
    }

    throw 'Unsupported file type. Upload .txt, .md, .csv, .json, or .pdf';
}

function isModelAccessError(err) {
    const code = err?.code || err?.error?.code;
    const msg = formatOpenAiError(err).toLowerCase();
    return code === 'model_not_found'
        || /does not have access to model/.test(msg)
        || /does not exist/.test(msg)
        || /model .* not found/.test(msg);
}

function usesKeywordRag(embeddingModel) {
    return embeddingModel === KEYWORD_RAG_MODEL;
}

function rankChunksByKeywords(chunks, question) {
    const terms = [...new Set(
        question.toLowerCase().split(/\W+/).filter((term) => term.length > 2)
    )];

    const scored = chunks.map((chunk) => {
        const text = chunk.text.toLowerCase();
        let score = 0;
        for (const term of terms) {
            const matches = text.split(term).length - 1;
            score += matches;
        }
        return { text: chunk.text, score };
    });

    const withHits = scored.filter((row) => row.score > 0);
    return (withHits.length ? withHits : scored)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
}

async function embedTextsWithModel(client, texts, model) {
    const embeddings = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
        const response = await client.embeddings.create({ model, input: batch });
        const sorted = [...response.data].sort((a, b) => a.index - b.index);
        embeddings.push(...sorted.map((row) => row.embedding));
    }
    return { model, embeddings };
}

async function embedTexts(client, texts, modelOverride) {
    if (!texts.length) {
        return {
            model: modelOverride || activeEmbeddingModel || EMBEDDING_MODEL,
            embeddings: []
        };
    }

    if (modelOverride && usesKeywordRag(modelOverride)) {
        return { model: KEYWORD_RAG_MODEL, embeddings: [] };
    }

    if (modelOverride) {
        return embedTextsWithModel(client, texts, modelOverride);
    }

    if (activeEmbeddingModel) {
        return embedTextsWithModel(client, texts, activeEmbeddingModel);
    }

    let lastErr;
    for (const model of EMBEDDING_MODEL_CANDIDATES) {
        try {
            const result = await embedTextsWithModel(client, texts, model);
            activeEmbeddingModel = model;
            console.log(`[OpenAI] RAG embeddings using ${model}`);
            return result;
        } catch (err) {
            lastErr = err;
            if (isModelAccessError(err)) {
                console.warn(`[OpenAI] embeddings: no access to ${model}, trying fallback`);
                continue;
            }
            throw err;
        }
    }

    throw new Error(
        'No embedding model available for this API key. Enable text-embedding-ada-002 in your OpenAI project, or RAG will use keyword search instead.'
    );
}

function isEmbeddingUnavailableError(err) {
    if (isModelAccessError(err)) return true;
    const msg = formatOpenAiError(err).toLowerCase();
    return /no embedding model available/.test(msg);
}

function todayLabel() {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
    });
}

function buildGeneralChatMessages(messages, memorySystemContent) {
    const parts = [];

    const baseSystem = [
        `Today is ${todayLabel()} (US Eastern).`,
        'You have web search for current events, politics, weather, sports, prices, and other time-sensitive topics.',
        'For personal questions about this user (who they are, their name, likes, hobbies, preferences, secrets they shared), answer from the long-term memory below — do NOT say you do not know them if memory lists those facts.',
        'Never invent personal facts that are not in memory.'
    ].join(' ');

    parts.push({
        role: 'system',
        content: baseSystem
    });

    if (memorySystemContent?.trim()) {
        parts.push({
            role: 'system',
            content: memorySystemContent.trim()
        });
    }

    const conversation = (messages || []).filter((m) => m.role === 'user' || m.role === 'assistant');
    return [...parts, ...conversation];
}

function buildResponsesRequestBody(prepared) {
    // Responses API accepts a single instructions string — merge ALL system messages
    // (date/rules + user memory). Using only .find() previously dropped memory.
    const systemParts = prepared
        .filter((m) => m.role === 'system' && m.content?.trim())
        .map((m) => m.content.trim());
    const instructions = systemParts.join('\n\n');
    const conversation = prepared.filter((m) => m.role !== 'system');

    return {
        model: RESPONSES_MODEL,
        ...(instructions ? { instructions } : {}),
        reasoning: { effort: REASONING_EFFORT },
        max_output_tokens: 4096,
        tools: [{
            type: 'web_search',
            search_context_size: process.env.OPENAI_SEARCH_CONTEXT_SIZE || 'medium'
        }],
        // auto: personal "who am I" questions should use memory, not forced web search
        tool_choice: 'auto',
        input: conversation.map((m) => ({ role: m.role, content: m.content }))
    };
}

function createStaticChatCompletion(client, messages, memorySystemContent) {
    return client.chat.completions.create({
        model: CHAT_MODEL,
        messages: buildGeneralChatMessages(messages, memorySystemContent)
    });
}

async function chatWithResponsesWebSearch(client, messages, memorySystemContent) {
    const prepared = buildGeneralChatMessages(messages, memorySystemContent);
    const response = await client.responses.create(buildResponsesRequestBody(prepared));
    const text = response.output_text || '';
    if (!text.trim()) {
        throw 'OpenAI returned an empty response';
    }
    console.log(`[OpenAI] chat via responses (${RESPONSES_MODEL} + web_search)`);
    return text;
}

async function chatWithSearchPreviewModels(client, messages, memorySystemContent) {
    let lastErr;

    for (const model of CHAT_SEARCH_MODELS) {
        try {
            const response = await client.chat.completions.create({
                model,
                messages: buildGeneralChatMessages(messages, memorySystemContent),
                web_search_options: {
                    search_context_size: process.env.OPENAI_SEARCH_CONTEXT_SIZE || 'medium',
                    user_location: {
                        type: 'approximate',
                        approximate: { country: 'US' }
                    }
                }
            });
            return response.choices[0]?.message?.content || '';
        } catch (err) {
            lastErr = err;
            if (!isModelAccessError(err)) {
                throw err;
            }
            console.warn(`[OpenAI] Search model unavailable: ${model}`);
        }
    }

    throw lastErr;
}

function isWebSearchConfigError(err) {
    const msg = formatOpenAiError(err).toLowerCase();
    return /tool_choice|web_search|does not support|not supported/.test(msg);
}

async function chat(messages, options = {}) {
    const memorySystemContent = options.memorySystemContent || '';
    return withOpenAiError('chat', async () => {
        const client = getClient();

        if (CHAT_WEB_SEARCH) {
            try {
                return await chatWithResponsesWebSearch(client, messages, memorySystemContent);
            } catch (err) {
                if (isWebSearchConfigError(err)) {
                    console.warn('[OpenAI] web_search tool_choice issue, retrying without required tool');
                    const prepared = buildGeneralChatMessages(messages, memorySystemContent);
                    const response = await client.responses.create({
                        ...buildResponsesRequestBody(prepared),
                        tool_choice: 'auto'
                    });
                    const text = response.output_text || '';
                    if (text.trim()) {
                        console.log(`[OpenAI] chat via responses (${RESPONSES_MODEL} + web_search auto)`);
                        return text;
                    }
                }

                if (!isModelAccessError(err) && !isWebSearchConfigError(err)) {
                    throw err;
                }
                console.warn('[OpenAI] Responses web_search unavailable, trying search API models');

                try {
                    const reply = await chatWithSearchPreviewModels(client, messages, memorySystemContent);
                    console.log('[OpenAI] chat via search-api model');
                    return reply;
                } catch (err2) {
                    if (!isModelAccessError(err2)) {
                        throw err2;
                    }
                    throw `Web search is enabled but unavailable for ${RESPONSES_MODEL}. Set OPENAI_RESPONSES_MODEL=gpt-5 or gpt-5-nano and restart the server, or set OPENAI_CHAT_WEB_SEARCH=false.`;
                }
            }
        }

        const response = await createStaticChatCompletion(client, messages, memorySystemContent);
        console.log(`[OpenAI] chat via static model (${CHAT_MODEL})`);
        return response.choices[0]?.message?.content || '';
    });
}

/**
 * Extract durable personal facts from the latest user/assistant turn.
 * Returns [] when nothing durable was shared.
 */
async function extractUserMemoryFacts(userMessage, assistantReply) {
    return withOpenAiError('extractUserMemoryFacts', async () => {
        const client = getClient();
        const response = await client.chat.completions.create({
            model: VISION_MODEL,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Extract durable personal facts about the USER from this chat turn.',
                        'Return JSON only: { "facts": [ { "key": "snake_case", "value": "short string", "category": "identity|preference|hobby|like|dislike|secret|other" } ] }',
                        'Include name, job, location, hobbies, likes, dislikes, pets, family, secrets they volunteer, preferences.',
                        'Skip greetings, one-off questions, news, and anything not about the user.',
                        'If nothing durable was shared, return { "facts": [] }.',
                        'Max 8 facts. Keep values under 200 characters.'
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: `USER SAID:\n${String(userMessage || '').slice(0, 4000)}\n\nASSISTANT SAID:\n${String(assistantReply || '').slice(0, 4000)}`
                }
            ]
        });

        const raw = response.choices[0]?.message?.content || '{}';
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return [];
        }

        const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
        return facts
            .filter((f) => f && f.key && f.value)
            .slice(0, 8)
            .map((f) => ({
                key: String(f.key),
                value: String(f.value),
                category: String(f.category || 'other')
            }));
    });
}

async function describeImage(buffer, mimeType, prompt) {
    return withOpenAiError('describeImage', async () => {
        const client = getClient();
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64}`;
        const userPrompt = prompt?.trim() || [
            'Identify what this image shows.',
            'If you recognize a specific subject — famous artwork, landmark, person, animal, plant, vehicle, nebula, galaxy, or other named thing — lead with the name and a short explanation of what it is.',
            'Use "likely" or "appears to be" when you are not fully confident.',
            'Then add brief visual details (colors, composition, setting).'
        ].join(' ');

        const response = await client.chat.completions.create({
            model: VISION_MODEL,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You analyze images for a general audience.',
                        'Prioritize identification: name recognizable subjects when you can (e.g. "The Starry Night" by Van Gogh, Ring Nebula / M57, Eiffel Tower).',
                        'Do not give only a generic visual description when a specific identification is reasonably likely.'
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: dataUrl } }
                    ]
                }
            ],
            max_tokens: 900
        });

        return response.choices[0]?.message?.content || '';
    });
}

function normalizeImageGenSize(size, model) {
    const requested = String(size || '1024x1024');
    if (isGptImageModel(model)) {
        const mapped = {
            '1792x1024': '1536x1024',
            '1024x1792': '1024x1536'
        };
        const normalized = mapped[requested] || requested;
        return GPT_IMAGE_SIZES.has(normalized) ? normalized : '1024x1024';
    }
    if (model === 'dall-e-2') {
        return DALLE2_SIZES.has(requested) ? requested : '1024x1024';
    }
    return DALLE3_SIZES.has(requested) ? requested : '1024x1024';
}

function isGptImageModel(model) {
    return String(model || '').startsWith('gpt-image');
}

function isLegacyDalleModel(model) {
    return model === 'dall-e-2' || model === 'dall-e-3';
}

function buildImagePrompt(prompt, options = {}) {
    let text = String(prompt || '').trim();
    if (!text) return text;

    if (options.style === 'natural') {
        text += '\n\nRender in a natural, realistic style with subdued colors.';
    } else if (options.style === 'vivid') {
        text += '\n\nRender in a vivid, colorful, dramatic style.';
    }
    return text;
}

function mapImageQuality(quality, model) {
    const hd = quality === 'hd';
    if (model === 'dall-e-3') {
        return hd ? 'hd' : 'standard';
    }
    if (isGptImageModel(model)) {
        return hd ? 'high' : 'medium';
    }
    return undefined;
}

function buildImageGenParams(model, prompt, options = {}) {
    const size = normalizeImageGenSize(options.size, model);
    const maxPrompt = model === 'dall-e-2' ? 1000 : 4000;
    const params = {
        model,
        prompt: prompt.slice(0, maxPrompt),
        n: 1,
        size
    };

    if (model === 'dall-e-3') {
        params.quality = mapImageQuality(options.quality, model);
        params.style = options.style === 'natural' ? 'natural' : 'vivid';
    } else if (isGptImageModel(model)) {
        params.quality = mapImageQuality(options.quality, model);
    }

    return params;
}

function isInvalidImageParamError(err) {
    const msg = formatOpenAiError(err).toLowerCase();
    return /unknown parameter/.test(msg);
}

async function imageResultToDataUrl(image) {
    if (image?.b64_json) {
        return {
            imageDataUrl: `data:image/png;base64,${image.b64_json}`,
            revisedPrompt: image.revised_prompt || null
        };
    }

    const url = image?.url;
    if (!url) {
        throw 'No image returned from OpenAI';
    }

    const imgRes = await openAiFetch(url);
    if (!imgRes.ok) {
        throw 'Failed to download generated image';
    }
    const buffer = await imgRes.buffer();
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    return {
        imageDataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
        revisedPrompt: image.revised_prompt || null
    };
}

async function generateImage(prompt, options = {}) {
    return withOpenAiError('generateImage', async () => {
        const client = getClient();
        const trimmed = buildImagePrompt(prompt, options);
        if (!trimmed) {
            throw 'Prompt is required';
        }

        let lastErr;
        const tried = [];
        const candidates = activeImageGenModel
            ? [activeImageGenModel, ...IMAGE_GEN_MODEL_CANDIDATES.filter((m) => m !== activeImageGenModel)]
            : IMAGE_GEN_MODEL_CANDIDATES;

        for (const model of candidates) {
            tried.push(model);
            try {
                let params = buildImageGenParams(model, trimmed, options);
                let response;

                try {
                    response = await client.images.generate(params);
                } catch (err) {
                    if (!isInvalidImageParamError(err)) {
                        throw err;
                    }
                    console.warn(`[OpenAI] image gen: retrying ${model} without optional params`);
                    params = {
                        model,
                        prompt: params.prompt,
                        n: 1,
                        size: params.size
                    };
                    response = await client.images.generate(params);
                }

                const image = response.data?.[0];
                const { imageDataUrl, revisedPrompt } = await imageResultToDataUrl(image);
                activeImageGenModel = model;
                console.log(`[OpenAI] image generated via ${model} (${params.size})`);

                return {
                    imageDataUrl,
                    revisedPrompt,
                    model,
                    size: params.size
                };
            } catch (err) {
                lastErr = err;
                if (isModelAccessError(err)) {
                    if (activeImageGenModel === model) {
                        activeImageGenModel = null;
                    }
                    console.warn(`[OpenAI] image gen: unavailable model ${model}, trying fallback`);
                    continue;
                }
                throw err;
            }
        }

        const triedList = [...new Set(tried)].join(', ');
        throw `Image generation is not enabled for this OpenAI project. Tried: ${triedList}. In platform.openai.com → your project → Model access, enable gpt-image-1 or gpt-image-1-mini.`;
    });
}

async function ingestDocument(buffer, mimeType, originalName) {
    return withOpenAiError('ingestDocument', async () => {
        const client = getClient();
        const text = await extractTextFromFile(buffer, mimeType, originalName);
        if (!text.trim()) {
            throw 'No readable text found in this document';
        }

        const maxChars = Math.max(50_000, parseInt(process.env.AI_RAG_MAX_CHARS || '1500000', 10));
        if (text.length > maxChars) {
            throw `Document is too large to index (${text.length.toLocaleString()} characters). Maximum is ${maxChars.toLocaleString()} characters of extracted text. Try a smaller file or split the document.`;
        }

        const chunks = chunkText(text);
        let embeddingModel;
        let chunkData;

        try {
            const { model, embeddings } = await embedTexts(client, chunks);
            embeddingModel = model;
            chunkData = chunks.map((chunkTextValue, index) => ({
                text: chunkTextValue,
                embedding: embeddings[index]
            }));
        } catch (err) {
            if (!isEmbeddingUnavailableError(err)) {
                throw err;
            }
            console.warn('[OpenAI] Embeddings unavailable — indexing document with keyword search instead');
            embeddingModel = KEYWORD_RAG_MODEL;
            chunkData = chunks.map((chunkTextValue) => ({
                text: chunkTextValue,
                embedding: []
            }));
        }

        return {
            text,
            embeddingModel,
            chunks: chunkData
        };
    });
}

async function askDocument(chunks, question, embeddingModel) {
    return withOpenAiError('askDocument', async () => {
        const client = getClient();
        let ranked;

        if (usesKeywordRag(embeddingModel)) {
            ranked = rankChunksByKeywords(chunks, question);
        } else {
            try {
                const { embeddings } = await embedTexts(client, [question], embeddingModel || activeEmbeddingModel);
                const questionEmbedding = embeddings[0];
                ranked = chunks
                    .map((chunk) => ({
                        text: chunk.text,
                        score: cosineSimilarity(questionEmbedding, chunk.embedding)
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 6);
            } catch (err) {
                if (!isEmbeddingUnavailableError(err)) {
                    throw err;
                }
                console.warn('[OpenAI] Embeddings unavailable for Q&A — using keyword search');
                ranked = rankChunksByKeywords(chunks, question);
            }
        }

        const context = ranked.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');

        const response = await client.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Answer using only the provided document excerpts. If the answer is not in the excerpts, say you cannot find it in the document.'
                },
                {
                    role: 'user',
                    content: `Document excerpts:\n${context}\n\nQuestion: ${question}`
                }
            ]
        });

        return {
            answer: response.choices[0]?.message?.content || '',
            sources: ranked.map((r) => ({ excerpt: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''), score: r.score }))
        };
    });
}

module.exports = {
    chat,
    describeImage,
    generateImage,
    ingestDocument,
    askDocument,
    extractUserMemoryFacts,
    getApiKey,
    getChatConfig: () => ({
        model: CHAT_WEB_SEARCH ? RESPONSES_MODEL : CHAT_MODEL,
        webSearch: CHAT_WEB_SEARCH,
        reasoningEffort: REASONING_EFFORT
    }),
    getImageGenConfig: () => ({
        model: IMAGE_GEN_MODEL,
        sizes: ['1024x1024', '1536x1024', '1024x1536'],
        supportsStyleParam: isLegacyDalleModel(IMAGE_GEN_MODEL)
    })
};
