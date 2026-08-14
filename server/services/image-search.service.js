const nodeFetch = require('node-fetch');

const USER_AGENT =
    process.env.WIKIMEDIA_USER_AGENT ||
    'MyProfilingApp/1.0 (AI Chat image lookup; contact=local-dev)';
const MAX_IMAGES = Math.min(12, Math.max(1, parseInt(process.env.AI_CHAT_MAX_IMAGES || '8', 10)));

/**
 * Dropped from a query wherever they appear. Only words that are never part of a
 * subject belong here — ambiguous ones like "post" (fence post) or "view" stay
 * out and are handled by the request phrases below, which need image words next
 * to them before they strip anything.
 */
const FILLER_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about',
    'please', 'me', 'my', 'some', 'any', 'also', 'just', 'can', 'you', 'could',
    'would', 'tell', 'show', 'display', 'find', 'get', 'give', 'send', 'pull',
    'up', 'look', 'explain', 'describe', 'what', 'who', 'is', 'are', 'including',
    'plus', 'few', 'provide', 'fetch', 'bring', 'upload', 'attach', 'want',
    'need', 'more', 'us', 'let', 'lets', 'search'
]);

/** Verbs that only count as a request when an image word follows them. */
const REQUEST_VERBS =
    'show|display|find|get|give|send|share|provide|post|fetch|bring|upload|attach|include|pull up|search for|look for';

/** Titles that often collide with animal / topic searches (nicknames, rides, tech, etc.). */
const DISTRACTOR_PATTERN =
    /\b(roller\s*coaster|coaster|amusement|theme\s*park|kings?\s*island|cedar\s*fair|six\s*flags|disney|ride\b|kobe|bryant|nba|lakers|film|movie|song|album|band|beer|malt\s*liquor|disambiguation|transformer|generative|pre-?trained|gpt|llm|neural|deep\s*learning|video\s*game|gameplay|logo|svg|diagram|architecture|firefighter|frying\s*pan|big\s*bang|sitcom|television|tv\s*series|tv\s*show|celebrity|actor|actress|portrait|headshot|selfie|manicure|pedicure|fingernail|toenail|ingrown|nine\s*inch\s*nails|cuticle)\b/i;

/** Query looks like an animal / wildlife ask. */
const ANIMAL_QUERY_PATTERN =
    /\b(snake|serpent|cobra|mamba|octopus|spider|shark|whale|dolphin|tiger|lion|bear|wolf|eagle|bird|fish|frog|lizard|turtle|crocodile|alligator|insect|reptile|amphibian|mammal|scorpion|jellyfish)\b/i;

/**
 * Evidence the image is actually about the living animal / species. Note that
 * "jellyfish" and "cuttlefish" do not match \bfish\b, so invertebrate terms are
 * listed in their own right.
 */
const BIO_EVIDENCE_PATTERN =
    /\b(snake|serpent|ophiophagus|dendroaspis|hapalochlaena|naja|python|viper|zoo|wildlife|herpet|species|national\s*park|wetland|reserve|female|male|hunting|hood|venom|reptile|amphibian|mammal|bird|fish|animal|jelly\s*fish|jellyfish|jelly|medusa|cnidaria\w*|chironex|carybdea|sea\s*wasp|tentacles?|stinger|octopus|squid|cuttlefish|nautilus|cephalopod|coral|anemone|urchin|starfish|crustacean|mollus[ck]\w*|invertebrate|marine|aquarium|reef|plankton)\b/i;

/**
 * Scientific names for common names, so an image titled only "Chironex fleckeri"
 * still counts as a match for "box jellyfish". Used both to widen the search and
 * to score the results it returns.
 */
const SPECIES_SYNONYMS = [
    { match: /\bbox\s*jelly(\s*fish)?\b|\bsea\s*wasp\b/i, names: ['chironex fleckeri', 'chironex', 'sea wasp', 'box jellyfish'] },
    { match: /\bjelly\s*fish\b|\bjellyfish\b/i, names: ['jellyfish', 'medusa', 'cnidaria'] },
    { match: /\bking\s*cobra\b/i, names: ['ophiophagus hannah', 'ophiophagus'] },
    { match: /\bblack\s*mamba\b/i, names: ['dendroaspis polylepis', 'dendroaspis'] },
    { match: /\bblue[\s-]*ring(ed)?\s*octopus\b/i, names: ['hapalochlaena'] }
];

/** Scientific / alternate names that also identify the subject of a query. */
function speciesSynonyms(query) {
    const q = String(query || '');
    const names = [];
    for (const entry of SPECIES_SYNONYMS) {
        if (entry.match.test(q)) {
            names.push(...entry.names);
        }
    }
    return [...new Set(names)];
}

/** Hardware fastener / nail evidence. */
const NAIL_EVIDENCE_PATTERN =
    /\b(nails?|fastener|fasteners|wire\s*nail|common\s*nail|box\s*nail|finish\s*nail|brad|spik|nagel|clou|carpentry|hardware|woodworking|10d|16d|8d|20d)\b/i;

function wantsImages(text) {
    return /\b(images?|pictures?|photos?|pics?)\b/i.test(String(text || ''));
}

/**
 * Derive a subject search string from a chat question that asked for images.
 * e.g. "tell me about the blue-ringed octopus and show me images" → "blue ringed octopus"
 */
function extractImageSearchQuery(text) {
    let q = String(text || '');

    q = q.replace(
        new RegExp(
            `\\b(${REQUEST_VERBS})\\s+((me|us)\\s+)?(with\\s+)?(some\\s+|a few\\s+|an?\\s+|more\\s+)?(pictures?|photos?|images?|pics?)\\b`,
            'gi'
        ),
        ' '
    );
    q = q.replace(/\b(with|including|plus)\s+(pictures?|photos?|images?|pics?)\b/gi, ' ');
    q = q.replace(/\b(pictures?|photos?|images?|pics?)\b/gi, ' ');
    q = q.replace(/\b(tell me about|tell me|what is|what are|who is|who are|look up)\b/gi, ' ');
    q = q.replace(/\b(please|can you|could you|would you|explain|describe)\b/gi, ' ');
    // Genre wrappers pad the query without appearing in photo titles
    // ("television show Big Bang Theory" → cast shots titled only "Big Bang Theory").
    q = q.replace(/\b(television|tv)\s+(show|series|programme|program|sitcom)\b/gi, ' ');
    q = q.replace(/\b(sitcom|tv\s*show|tv\s*series)\b/gi, ' ');
    q = q.replace(/[-\u2013\u2014]+/g, ' ');
    q = q.replace(/[?!.,;:'"()]+/g, ' ');
    q = q.replace(/\s+/g, ' ').trim();

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

/**
 * Keep the user's real question, but hide that they also asked for pictures.
 * The gallery is fetched separately, so the model should only write the article.
 */
function stripImageRequestFromQuestion(text) {
    let q = String(text || '');
    q = q.replace(
        new RegExp(
            `\\b(${REQUEST_VERBS})\\s+((me|us)\\s+)?(with\\s+)?(some\\s+|a few\\s+|an?\\s+|more\\s+)?(pictures?|photos?|images?|pics?)\\b`,
            'gi'
        ),
        ' '
    );
    q = q.replace(/\b(with|including|plus|and)\s+(some\s+|a few\s+|an?\s+|more\s+)?(pictures?|photos?|images?|pics?)\b/gi, ' ');
    q = q.replace(/\b(pictures?|photos?|images?|pics?)\b/gi, ' ');
    q = q.replace(/\s*(?:,|;|\band\b)\s*$/i, '');
    q = q.replace(/\s+/g, ' ').trim();
    return q || String(text || '').trim();
}

function significantTokens(query) {
    return String(query || '')
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ''))
        .filter((t) => t.length >= 3 && !FILLER_WORDS.has(t));
}

/**
 * Score how well an image title/url matches the search subject.
 * Drops nickname/film/tech/theme-park/TV collisions and requires domain evidence.
 */
function relevanceScore(img, query) {
    const hay = `${img.title || ''} ${img.pageUrl || ''} ${img.url || ''}`.toLowerCase();
    const tokens = significantTokens(query);
    if (!tokens.length) return 0;

    // Reject theme-park / TV / celebrity collisions for unrelated subjects
    // (e.g. animal searches). When the user asked for that topic — "Big Bang
    // Theory", a sitcom, a celebrity — those same words are the match signal,
    // not noise, so do not discard them.
    if (DISTRACTOR_PATTERN.test(hay) && !DISTRACTOR_PATTERN.test(query)) {
        return -80;
    }

    // Ignore placeholder titles that were incorrectly set to the query string
    const titleOnly = String(img.title || '').toLowerCase().trim();
    const titleIsQuery = titleOnly && titleOnly === String(query || '').toLowerCase().trim();

    let matched = 0;
    let score = 0;
    for (const t of tokens) {
        if (hay.includes(t)) {
            matched += 1;
            score += t.length >= 5 ? 4 : 2;
        }
    }

    // The title naming the whole subject, or the species behind it, is the
    // strongest signal there is — stronger than any vocabulary list.
    const allTokensPresent = matched === tokens.length;
    const synonymHit = speciesSynonyms(query).some((name) => hay.includes(name));
    if (synonymHit) {
        matched += 1;
        score += 8;
    }

    const animalQuery = ANIMAL_QUERY_PATTERN.test(query);
    const nailQuery = /\bnails?\b/i.test(query);

    // Hardware nails: require fastener evidence; do NOT require "penny"/"ten" in the filename
    if (nailQuery) {
        if (!NAIL_EVIDENCE_PATTERN.test(hay)) {
            return -60;
        }
        // Reject band / cosmetic / medical fingernail hits that still contain "nail".
        // Photo sites are far heavier on nail art than Commons was, hence the salon terms.
        if (/\bnine\s*inch|ingrown|finger|toe|manicur\w*|pedicur\w*|cuticle|french\s*nail|nail\s*(art|polish|salon|design|studio)|acrylic|gel\s*nails|unhas\b/i.test(hay)) {
            return -90;
        }
        score += 12;
        if (/\bnail\s*\(fastener\)|common\s*nail|wire\s*nail|box\s*nail|finish\s*nail|fastener\s*example/i.test(hay)) {
            score += 16;
        }
        if (/\b(penny|10d|16d|8d|20d)\b/i.test(hay)) {
            score += 6;
        }
        if (/\bnail\s*gun\b/i.test(hay)) {
            score -= 10;
        }
        // Prefer clear object photos over people nailing lumber
        if (/\b(seabee|navy|worker|supervises|iraq|soldier|marine)\b/i.test(hay)) {
            score -= 14;
        }
        return score;
    }

    // Require the most distinctive token for general queries (not nail/animal domain rules)
    if (!animalQuery) {
        const distinctive = [...tokens].sort((a, b) => b.length - a.length)[0];
        if (distinctive && distinctive.length >= 4 && !hay.includes(distinctive)) {
            // Hard-reject only when almost nothing else matched. Otherwise a
            // leftover genre word (e.g. "television") would wipe out on-topic
            // titles like "The Big Bang Theory".
            if (matched < 2) {
                return -20;
            }
            score -= 4;
        }
        if (tokens.length >= 2 && matched < Math.min(2, tokens.length)) {
            score -= 6;
        }
    }

    if (matched === 0 && !titleIsQuery) return -100;
    if (titleIsQuery && matched > 0 && !NAIL_EVIDENCE_PATTERN.test(hay) && !BIO_EVIDENCE_PATTERN.test(hay)) {
        // Title was faked as the query — only URL/path can save it
        const path = String(img.url || '').toLowerCase();
        if (!tokens.some((t) => path.includes(t))) {
            return -100;
        }
    }

    const hasBio = BIO_EVIDENCE_PATTERN.test(hay);
    const hasBinomial = /\b[a-z]{4,}\s+[a-z]{4,}\b/.test(hay) && hasBio;

    if (animalQuery) {
        if (!hasBio && !hasBinomial && !allTokensPresent && !synonymHit) {
            return -40;
        }
        score += hasBio ? 10 : 0;
        score += hasBinomial ? 6 : 0;
        score += allTokensPresent ? 8 : 0;
    } else if (hasBio) {
        score += 4;
    }

    // King cobra is Ophiophagus — not Indian cobra (Naja) or theme-park rides
    if (/\bking\b/i.test(query) && /\bcobra\b/i.test(query)) {
        if (/\bophiophagus\b/i.test(hay) || /\bking\s*cobra\b/i.test(hay)) {
            score += 14;
        }
        if (/\bnaja\b/i.test(hay) && !/\bophiophagus\b/i.test(hay) && !/\bking\s*cobra\b/i.test(hay)) {
            score -= 30;
        }
        if (/\bindian\s+cobra\b/i.test(hay) && !/\bking\s*cobra\b/i.test(hay)) {
            score -= 30;
        }
        if (!/\bking\b/i.test(hay) && !/\bophiophagus\b/i.test(hay)) {
            score -= 12;
        }
    }

    return score;
}

function filterRelevantImages(images, query) {
    return (images || [])
        .map((img) => ({ img, score: relevanceScore(img, query) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.img);
}

/** Alternate queries — prefer full phrase / species disambiguation first. */
function buildSearchQueryVariants(query) {
    const base = String(query || '').trim();
    if (!base) return [];

    const variants = [];
    const noHyphen = base.replace(/[-\u2013\u2014]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Disambiguate common animal nickname collisions
    if (/\bcobra\b/i.test(noHyphen) && !/\bsnake\b/i.test(noHyphen)) {
        variants.push(`${noHyphen} snake`);
        variants.push('Ophiophagus hannah');
    }
    if (/\bmamba\b/i.test(noHyphen) && !/\bsnake\b/i.test(noHyphen)) {
        variants.push(`${noHyphen} snake`);
        if (/\bblack\b/i.test(noHyphen)) {
            variants.push('Dendroaspis polylepis');
        }
    }
    if (/\boctopus\b/i.test(noHyphen) && /\bblue\b/i.test(noHyphen)) {
        variants.push('Hapalochlaena');
        variants.push('blue ringed octopus');
    }

    // Scientific names find far better photos than the common name alone.
    variants.push(...speciesSynonyms(noHyphen));

    // Hardware: "ten penny nail" / "10d nail" — Commons phrase search is noisy; use better terms
    if (/\bnails?\b/i.test(noHyphen)) {
        variants.unshift('Nail (fastener)');
        variants.push('common nail');
        variants.push('wire nail');
        variants.push('File:Nails.jpg');
        if (/\b(penny|10d|16d|8d|20d)\b/i.test(noHyphen)) {
            variants.unshift('penny nail');
            variants.push('10d nail');
            variants.push('common wire nail');
        }
    }

    variants.push(base);
    if (noHyphen && noHyphen !== base) variants.push(noHyphen);

    return [...new Set(variants.filter(Boolean))];
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
    return /^image\/(jpeg|jpg|png|gif|webp)$/i.test(String(mime || ''));
}

/** Anonymous Openverse requests are rejected above 20 results per page. */
const OPENVERSE_PAGE_SIZE = 20;

/** Smallest usable edge — Openverse carries thumbnails too small for the lightbox. */
const OPENVERSE_MIN_EDGE = 200;

/**
 * Credit line for a CC-licensed result, e.g. "Flickr (CC BY-NC)". Public domain
 * marks are their own label, so they don't come out as "CC CC0".
 */
function openverseCredit(item) {
    const provider = String(item.source || item.provider || 'Openverse').replace(/[_-]+/g, ' ').trim();
    const name = provider.charAt(0).toUpperCase() + provider.slice(1);
    const license = String(item.license || '').toLowerCase();

    if (!license) return name;
    if (license === 'cc0' || license === 'pdm') return `${name} (${license.toUpperCase()})`;
    return `${name} (CC ${license.toUpperCase()})`;
}

/**
 * Search Openverse, which aggregates Flickr, museums and public archives. This
 * is the primary source because Commons only holds encyclopedic files — for a
 * subject like "bugs bunny" that meant the same Walk of Fame stars every time.
 */
async function searchOpenverseImages(query, limit = MAX_IMAGES, page = 1) {
    const params = new URLSearchParams({
        q: query,
        page_size: String(Math.min(OPENVERSE_PAGE_SIZE, Math.max(limit * 2, 10))),
        page: String(Math.max(1, page)),
        extension: 'jpg,jpeg,png,gif,webp',
        mature: 'false'
    });

    const res = await nodeFetch(`https://api.openverse.org/v1/images/?${params}`, {
        headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json'
        },
        timeout: 12000
    });
    if (!res.ok) {
        throw new Error(`Openverse HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    const images = results
        .filter((item) => {
            const edge = Math.min(Number(item.width) || 0, Number(item.height) || 0);
            return !edge || edge >= OPENVERSE_MIN_EDGE;
        })
        .map((item) => ({
            url: item.url,
            title: String(item.title || '').trim() || query,
            source: openverseCredit(item),
            pageUrl: item.foreign_landing_url || item.url
        }))
        .filter((img) => /^https?:\/\//i.test(String(img.url || '')));

    return filterRelevantImages(images, query).slice(0, limit);
}

/**
 * Search Wikimedia Commons file namespace for topical images.
 * Fetches extra candidates, then relevance-filters.
 */
async function searchCommonsImages(query, limit = MAX_IMAGES, page = 1) {
    const fetchLimit = Math.min(30, Math.max(limit * 3, 12));
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: query,
        gsrlimit: String(fetchLimit),
        gsroffset: String(Math.max(0, page - 1) * fetchLimit),
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

    return filterRelevantImages(images, query).slice(0, limit);
}

/**
 * Fallback: Wikipedia article thumbnails — filtered hard for title relevance.
 */
async function searchWikipediaPageImages(query, limit = MAX_IMAGES, page = 1) {
    const fetchLimit = Math.min(20, Math.max(limit * 2, 8));
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: String(fetchLimit),
        gsroffset: String(Math.max(0, page - 1) * fetchLimit),
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
    }

    return filterRelevantImages(images, query).slice(0, limit);
}

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

    const images = items
        .map((item) => ({
            url: item.link,
            title: String(item.title || query).trim(),
            source: 'Google Images',
            pageUrl: item.image?.contextLink || item.link
        }))
        .filter((img) => /^https?:\/\//i.test(img.url));

    return filterRelevantImages(images, query).slice(0, limit);
}

/**
 * Only reuse model-cited Wikimedia URLs when alt text / URL path independently
 * looks on-topic. Never set title=query (that made random URLs score as perfect matches).
 */
function extractImagesFromText(text, query) {
    const src = String(text || '');
    const found = [];
    const re = /!\[([^\]]*)\]\((https?:\/\/upload\.wikimedia\.org\/[^)\s]+)\)/gi;
    const tokens = significantTokens(query);
    let match;
    while ((match = re.exec(src)) !== null) {
        const alt = String(match[1] || '').trim();
        const url = match[2].replace(/[.,;:]+$/, '');
        const path = decodeURIComponent(url).toLowerCase();
        const evidence = `${alt} ${path}`;
        const hasToken = tokens.some((t) => evidence.includes(t));
        if (!hasToken) {
            continue;
        }
        found.push({
            url,
            title: alt || 'Wikimedia image',
            source: 'Wikimedia Commons',
            pageUrl: url
        });
    }
    return filterRelevantImages(found, query);
}

/**
 * Photo sites publish long same-titled series — five near-identical snake farm
 * shots in a row — which is what "the same images over and over" looks like
 * inside a single result set. Keep the best few per title, and hold the rest
 * back rather than dropping them, so a thin subject still fills the grid.
 */
function diversifyImages(images, perTitle = 2) {
    const counts = new Map();
    const kept = [];
    const overflow = [];

    for (const img of images || []) {
        const key = String(img.title || '')
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const seen = counts.get(key) || 0;
        if (!key || seen < perTitle) {
            counts.set(key, seen + 1);
            kept.push(img);
        } else {
            overflow.push(img);
        }
    }

    return [...kept, ...overflow];
}

/** Same picture, whatever query string is hanging off it. */
function imageKey(urlOrImage) {
    const url = typeof urlOrImage === 'string' ? urlOrImage : urlOrImage?.url;
    return String(url || '').split('?')[0].toLowerCase();
}

function dedupeImages(images) {
    const seen = new Set();
    const out = [];
    for (const img of images) {
        const key = imageKey(img);
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

    const lines = ['', '', `**Images** for “${query}”:`, ''];

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

/**
 * Openverse first, then Wikimedia to top up whatever it missed. `limit` is how
 * many candidates to collect, but the later sources are skipped as soon as
 * there are enough to fill the grid — a good Openverse result set costs one
 * request. Ranking stays relevance-first across all of them.
 */
async function searchAllSources(query, limit = MAX_IMAGES, page = 1) {
    const sources = [
        ['Openverse', searchOpenverseImages],
        ['Commons', searchCommonsImages],
        ['Wikipedia', searchWikipediaPageImages]
    ];

    const enough = Math.min(limit, MAX_IMAGES);
    let images = [];

    for (const [name, search] of sources) {
        if (images.length >= enough) break;
        try {
            const found = await search(query, limit, page);
            images = filterRelevantImages(dedupeImages([...images, ...found]), query);
        } catch (err) {
            console.warn(`[ImageSearch] ${name} failed:`, err?.message || err);
        }
    }

    // Google paging is a separate quota question, so the last resort only ever
    // answers the first request.
    if (!images.length && page === 1) {
        try {
            images = await searchGoogleImages(query, limit);
        } catch (err) {
            console.warn('[ImageSearch] Google CSE failed:', err?.message || err);
        }
    }

    return filterRelevantImages(dedupeImages(images), query).slice(0, limit);
}

/**
 * When the user asks for images, fetch topical photos
 * (Openverse → Commons → Wikipedia → optional Google).
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

    // Collect more candidates than get shown, so near-duplicate series can be
    // thinned out below without leaving gaps in the grid.
    const pool = MAX_IMAGES * 2;

    let images = [];
    for (const variant of buildSearchQueryVariants(query)) {
        const found = await searchAllSources(variant, pool);
        images = filterRelevantImages(dedupeImages([...images, ...found]), query);
        if (images.length >= MAX_IMAGES) {
            console.log(`[ImageSearch] ${images.length} relevant hit(s) after variant="${variant}"`);
            break;
        }
        if (found.length) {
            console.log(`[ImageSearch] ${found.length} hit(s) for variant="${variant}" (total ${images.length})`);
        }
    }

    // Do NOT salvage images from the model reply by default — web_search citations
    // frequently include unrelated Wikimedia files (TV logos, portraits, etc.).
    if (images.length === 0 && assistantReply) {
        const fromReply = extractImagesFromText(assistantReply, query);
        if (fromReply.length) {
            images = fromReply;
            console.log(`[ImageSearch] used ${fromReply.length} verified URL(s) from assistant reply`);
        }
    }

    images = diversifyImages(images).slice(0, MAX_IMAGES);

    return {
        wanted: true,
        query,
        images,
        markdown: formatImagesMarkdown(images, query)
    };
}

/** How many pages deep one press of "more images" is willing to dig. */
const MORE_PAGE_ATTEMPTS = 2;

/**
 * A second helping for a subject already on screen. Paging the sources is what
 * makes these different pictures rather than the same ones re-ranked, and the
 * URLs already shown are excluded in case a source repeats itself across pages.
 */
async function fetchMoreImages(query, options = {}) {
    const subject = String(query || '').trim();
    if (!subject) {
        return { query: '', images: [] };
    }

    const exclude = new Set((options.exclude || []).map(imageKey).filter(Boolean));
    const variants = buildSearchQueryVariants(subject);
    const pool = MAX_IMAGES * 2;

    // Roughly where the caller left off. Relevance filtering means this drifts
    // from the true page, which is why seen URLs are excluded as well.
    const firstPage = Math.max(2, Math.floor(exclude.size / MAX_IMAGES) + 1);
    let images = [];

    for (let attempt = 0; attempt < MORE_PAGE_ATTEMPTS && images.length < MAX_IMAGES; attempt += 1) {
        const page = firstPage + attempt;

        for (const variant of variants) {
            const found = await searchAllSources(variant, pool, page);
            const fresh = found.filter((img) => !exclude.has(imageKey(img.url)));
            images = filterRelevantImages(dedupeImages([...images, ...fresh]), subject);
            if (images.length >= MAX_IMAGES) break;
        }
    }

    images = diversifyImages(images).slice(0, MAX_IMAGES);
    console.log(`[ImageSearch] more: query="${subject}" page>=${firstPage} gave ${images.length}`);

    return { query: subject, images };
}

/**
 * The model still sometimes writes "I can't display images" and a list of
 * guessed URLs. The gallery below the reply is the only picture source, so
 * that chatter is removed before the reply is shown or saved.
 */
function stripModelImageMentions(text) {
    let out = String(text || '');

    out = out.replace(/!\[[^\]]*\]\(\s*https?:\/\/[^)]+\)/gi, '');
    out = out.replace(
        /\[([^\]]*)\]\(\s*https?:\/\/[^)]+\.(?:jpe?g|png|gif|webp|svg)(?:\?[^)]*)?\s*\)/gi,
        '$1'
    );
    out = out.replace(
        /https?:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org|(?:[\w.-]+\.)?staticflickr\.com|live\.staticflickr\.com)\S*/gi,
        ''
    );
    out = out.replace(/https?:\/\/\S+\.(?:jpe?g|png|gif|webp|svg)(?:\?\S*)?/gi, '');

    out = out.replace(/^\s*#{0,3}\s*\*{0,2}(?:images?|image options|photos?|pictures?|gallery)\*{0,2}\s*$/gim, '');
    out = out.replace(/^\s*Source:\s*(?:Wikimedia Commons|Flickr|Wikipedia|Openverse).*$/gim, '');

    out = out.replace(
        /(?:^|\n)[^\n]*(?:can(?:not|'t)|\bunable to\b|\bnot able to\b)\s+(?:display|show|embed|render|include)\s+images?[^\n]*/gi,
        ''
    );
    out = out.replace(/(?:^|\n)[^\n]*here are (?:some )?(?:image|photo|picture) options[^\n]*/gi, '');
    out = out.replace(
        /(?:^|\n)[^\n]*if you(?:'d| would) like[^\n]*(?:images?|photos?|pictures?|galler(?:y|ies)|captions?|references)[^\n]*/gi,
        ''
    );
    out = out.replace(
        /(?:^|\n)[^\n]*i can (?:fetch|pull|compile|provide|search for|look up|find|show|assemble|curate|put together)[^\n]*(?:images?|photos?|pictures?|galler(?:y|ies)|captions?)[^\n]*/gi,
        ''
    );
    out = out.replace(
        /[^.!?\n]*(?:and )?i can fetch a gallery of images[^.!?\n]*[.!?]?/gi,
        ''
    );
    out = out.replace(
        /[^.!?\n]*(?:fetch|compile|pull|assemble|curate)\s+(?:a |an |higher[^.!\n]*?)?(?:galler(?:y|ies)|images?)[^.!?\n]*[.!?]?/gi,
        ''
    );

    // Drop a trailing numbered "photo options" list as a whole, then mop up
    // any remaining caption lines that still mention pictures.
    out = stripTrailingImageOptionList(out);
    out = out.replace(
        /^\s*(?:\d+[.)]|[-*])\s+[^\n]*(?:https?:\/\/|example image|wikimedia commons|flickr|source:\s|images?|photos?|pictures?|galler(?:y|ies)|close-?ups?|thumbnails?|captions?|context image)[^\n]*/gim,
        ''
    );

    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Numbered leftovers like "3) Close-up..." after URL lines were already removed. */
function stripTrailingImageOptionList(text) {
    const lines = String(text || '').split('\n');
    let end = lines.length - 1;
    while (end >= 0 && !lines[end].trim()) end -= 1;

    const listItem = /^\s*(?:\d+[.)]|[-*])\s+/;
    const imageish = /\b(images?|photos?|pictures?|galler(?:y|ies)|close-?ups?|thumbnails?|captions?|wikimedia|flickr|context image)\b/i;

    let start = end;
    let sawImageish = false;
    while (start >= 0 && listItem.test(lines[start])) {
        if (imageish.test(lines[start])) sawImageish = true;
        start -= 1;
    }
    start += 1;

    if (sawImageish && end >= start) {
        lines.splice(start, end - start + 1);
    }
    return lines.join('\n');
}

/**
 * Conversation sent to the model: no picture request, no leftover gallery markdown.
 */
function hideImageRequestFromMessages(messages) {
    return (messages || []).map((m) => {
        if (m.role === 'user') {
            return { ...m, content: stripImageRequestFromQuestion(m.content) };
        }
        if (m.role === 'assistant') {
            let content = String(m.content || '').replace(/\n*\*\*Images\*\*[^\n]*\n*/gi, '\n');
            content = stripModelImageMentions(content);
            return { ...m, content };
        }
        return m;
    });
}

module.exports = {
    wantsImages,
    extractImageSearchQuery,
    stripImageRequestFromQuestion,
    hideImageRequestFromMessages,
    fetchImagesForChat,
    fetchMoreImages,
    stripModelImageMentions,
    relevanceScore,
    MAX_IMAGES
};
