const nodeFetch = require('node-fetch');

const USER_AGENT =
    process.env.WIKIMEDIA_USER_AGENT ||
    'MyProfilingApp/1.0 (AI Chat image lookup; contact=local-dev)';
const MAX_IMAGES = Math.min(12, Math.max(1, parseInt(process.env.AI_CHAT_MAX_IMAGES || '8', 10)));

const FILLER_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about',
    'please', 'me', 'my', 'some', 'any', 'also', 'just', 'can', 'you', 'could',
    'would', 'tell', 'show', 'display', 'find', 'get', 'give', 'send', 'pull',
    'up', 'look', 'explain', 'describe', 'what', 'who', 'is', 'are', 'including',
    'plus', 'few'
]);

function wantsImages(text) {
    return /\b(images?|pictures?|photos?)\b/i.test(String(text || ''));
}

/**
 * Derive a subject search string from a chat question that asked for images.
 * e.g. "tell me about the blue-ringed octopus and show me images" → "blue ringed octopus"
 */
function extractImageSearchQuery(text) {
    let q = String(text || '');

    // Drop image-request phrasing first
    q = q.replace(
        /\b(show|display|find|get|give|send|pull up)\s+(me\s+)?(some\s+|a few\s+|an?\s+)?(pictures?|photos?|images?)\b/gi,
        ' '
    );
    q = q.replace(/\b(with|including|plus)\s+(pictures?|photos?|images?)\b/gi, ' ');
    q = q.replace(/\b(pictures?|photos?|images?)\b/gi, ' ');

    // Drop question framing (multi-word first)
    q = q.replace(/\b(tell me about|tell me|what is|what are|who is|who are|look up)\b/gi, ' ');
    q = q.replace(/\b(please|can you|could you|would you|explain|describe)\b/gi, ' ');

    // Hyphens → spaces so "blue-ringed" matches Commons as "blue ringed"
    q = q.replace(/[-\u2013\u2014]+/g, ' ');
    q = q.replace(/[?!.,;:'"()]+/g, ' ');
    q = q.replace(/\s+/g, ' ').trim();

    // Remove filler words by token (avoids mangling words like "about")
    const tokens = q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !FILLER_WORDS.has(t.toLowerCase()));

    q = tokens.join(' ').trim();

    if (q.length < 2) {
        q = String(text || '')
            .replace(/\b(pictures?|photos?|images?)\b/gi, ' ')
            .replace(/[-\u2013\u2014]+/g, ' ')
            .replace(/[?!.,;:]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return q.slice(0, 120);
}

/** Alternate queries to try when the first search is empty. */
function buildSearchQueryVariants(query) {
    const base = String(query || '').trim();
    if (!base) return [];

    const variants = [base];
    const noHyphen = base.replace(/[-\u2013\u2014]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (noHyphen && noHyphen !== base) variants.push(noHyphen);

    // Last 3 significant words (helps when framing words leaked in)
    const parts = noHyphen.split(/\s+/).filter(Boolean);
    if (parts.length > 3) {
        variants.push(parts.slice(-3).join(' '));
    }
    if (parts.length > 2) {
        variants.push(parts.slice(-2).join(' '));
    }

    return [...new Set(variants)];
}

async function wikiFetch(url) {
    const res = await nodeFetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json'
        },
        timeout: 15000
    });
    if (!res.ok) {
        throw new Error(`Wikimedia HTTP ${res.status}`);
    }
    return res.json();
}

function isLikelyImageMime(mime) {
    return /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/i.test(String(mime || ''));
}

/**
 * Search Wikimedia Commons file namespace for topical images.
 */
async function searchCommonsImages(query, limit = MAX_IMAGES) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: query,
        gsrlimit: String(limit),
        prop: 'imageinfo',
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: '800'
    });

    const data = await wikiFetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    const pages = data?.query?.pages || {};
    const images = [];

    for (const page of Object.values(pages)) {
        const info = page?.imageinfo?.[0];
        if (!info) continue;
        if (info.mime && !isLikelyImageMime(info.mime)) continue;

        const url = info.thumburl || info.url;
        if (!url || !/^https?:\/\//i.test(url)) continue;

        const title = String(page.title || '')
            .replace(/^File:/i, '')
            .replace(/\.[a-z0-9]+$/i, '')
            .replace(/_/g, ' ')
            .trim();

        images.push({
            url,
            title: title || query,
            source: 'Wikimedia Commons',
            pageUrl: info.descriptionurl || info.url
        });
    }

    return images;
}

/**
 * Fallback: Wikipedia article thumbnails for the search topic.
 */
async function searchWikipediaPageImages(query, limit = MAX_IMAGES) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: String(Math.max(limit, 3)),
        prop: 'pageimages|info',
        piprop: 'thumbnail|name',
        pithumbsize: '800',
        inprop: 'url'
    });

    const data = await wikiFetch(`https://en.wikipedia.org/w/api.php?${params}`);
    const pages = data?.query?.pages || {};
    const images = [];

    for (const page of Object.values(pages)) {
        const thumb = page?.thumbnail?.source;
        if (!thumb || !/^https?:\/\//i.test(thumb)) continue;

        images.push({
            url: thumb,
            title: String(page.title || query).trim(),
            source: 'Wikipedia',
            pageUrl: page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`
        });

        if (images.length >= limit) break;
    }

    return images;
}

/**
 * Optional Google Custom Search (image) when env keys are configured.
 */
async function searchGoogleImages(query, limit = MAX_IMAGES) {
    const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID;
    if (!apiKey || !cx) {
        return [];
    }

    const params = new URLSearchParams({
        key: apiKey,
        cx,
        q: query,
        searchType: 'image',
        num: String(Math.min(limit, 10)),
        safe: 'active'
    });

    const res = await nodeFetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
        timeout: 12000
    });
    if (!res.ok) {
        throw new Error(`Google CSE HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    return items.slice(0, limit).map((item) => ({
        url: item.link,
        title: String(item.title || query).trim(),
        source: 'Google Images',
        pageUrl: item.image?.contextLink || item.link
    })).filter((img) => /^https?:\/\//i.test(img.url));
}

/**
 * If the model/web-search already listed Wikimedia image URLs, reuse them.
 */
function extractImagesFromText(text, query) {
    const src = String(text || '');
    const found = [];
    const re = /https?:\/\/upload\.wikimedia\.org\/[^\s)\]"'<>]+/gi;
    let match;
    while ((match = re.exec(src)) !== null) {
        let url = match[0].replace(/[.,;:]+$/, '');
        // Prefer a reasonably sized thumb if a raw commons path appears without thumb
        found.push({
            url,
            title: query || 'Image',
            source: 'Wikimedia Commons',
            pageUrl: url
        });
    }
    return dedupeImages(found);
}

function dedupeImages(images) {
    const seen = new Set();
    const out = [];
    for (const img of images) {
        const key = String(img.url || '').split('?')[0].toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(img);
    }
    return out;
}

function formatImagesMarkdown(images, query) {
    if (!images?.length) {
        return `\n\n_No images found for “${query}”._`;
    }

    const lines = [
        '',
        '',
        `**Images** for “${query}”:`,
        ''
    ];

    for (const img of images) {
        const alt = (img.title || query).replace(/[\[\]]/g, '');
        lines.push(`![${alt}](${img.url})`);
        if (img.source || img.pageUrl) {
            const label = img.source || 'Source';
            if (img.pageUrl) {
                lines.push(`[${label}](${img.pageUrl})`);
            } else {
                lines.push(`_${label}_`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

async function searchAllSources(query, limit = MAX_IMAGES) {
    let images = [];

    try {
        images = await searchCommonsImages(query, limit);
    } catch (err) {
        console.warn('[ImageSearch] Commons failed:', err?.message || err);
    }

    if (images.length < 2) {
        try {
            const wiki = await searchWikipediaPageImages(query, limit);
            images = dedupeImages([...images, ...wiki]);
        } catch (err) {
            console.warn('[ImageSearch] Wikipedia failed:', err?.message || err);
        }
    }

    if (!images.length) {
        try {
            images = await searchGoogleImages(query, limit);
        } catch (err) {
            console.warn('[ImageSearch] Google CSE failed:', err?.message || err);
        }
    }

    return dedupeImages(images);
}

/**
 * When the user asks for images, fetch topical photos (Commons → Wikipedia → optional Google).
 * @param {string} userMessage
 * @param {string} [assistantReply] optional — used to salvage Wikimedia URLs from web search text
 */
async function fetchImagesForChat(userMessage, assistantReply = '') {
    if (!wantsImages(userMessage)) {
        return { wanted: false, query: '', images: [], markdown: '' };
    }

    const query = extractImageSearchQuery(userMessage);
    if (!query) {
        return { wanted: true, query: '', images: [], markdown: '\n\n_Could not determine what to search images for._' };
    }

    console.log(`[ImageSearch] query="${query}" from "${String(userMessage).slice(0, 80)}"`);

    let images = [];
    for (const variant of buildSearchQueryVariants(query)) {
        images = await searchAllSources(variant, MAX_IMAGES);
        if (images.length) {
            console.log(`[ImageSearch] ${images.length} hit(s) for variant="${variant}"`);
            break;
        }
    }

    // Salvage image URLs the model already found via web_search
    if (images.length < 2 && assistantReply) {
        const fromReply = extractImagesFromText(assistantReply, query);
        if (fromReply.length) {
            images = dedupeImages([...images, ...fromReply]);
            console.log(`[ImageSearch] added ${fromReply.length} URL(s) from assistant reply`);
        }
    }

    images = images.slice(0, MAX_IMAGES);

    return {
        wanted: true,
        query,
        images,
        markdown: formatImagesMarkdown(images, query)
    };
}

module.exports = {
    wantsImages,
    extractImageSearchQuery,
    fetchImagesForChat,
    MAX_IMAGES
};
