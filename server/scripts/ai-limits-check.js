/**
 * Confirms every limit the in-app help displays is exported as a number, so the
 * /status payload cannot silently start returning undefined and leave the help
 * dialog quoting blanks.
 *
 *   node scripts/ai-limits-check.js
 */
// Loaded the way server.js does, so the numbers reported here are the ones the
// running server would report.
try {
    require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });
} catch (e) {
    // absent on Render, where these come from real environment variables
}

const openaiService = require('../services/openai.service');
const aiMemoryService = require('../services/ai-memory.service');
const imageSearchService = require('../services/image-search.service');
const aiUsageService = require('../services/ai-usage.service');

const limits = {
    'RAG_MAX_CHARS (chars indexed per document)': openaiService.RAG_MAX_CHARS,
    'MAX_MESSAGES (chat history kept)': aiMemoryService.MAX_MESSAGES,
    'MAX_FACTS (memory facts kept)': aiMemoryService.MAX_FACTS,
    'MAX_IMAGES (images per reply)': imageSearchService.MAX_IMAGES,
    'IMAGE_DAILY_LIMIT (images per day)': aiUsageService.IMAGE_DAILY_LIMIT
};

let failed = 0;
for (const [label, value] of Object.entries(limits)) {
    const ok = typeof value === 'number' && Number.isFinite(value);
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}: ${value}`);
}

console.log(failed ? `\n${failed} limit(s) not exported as numbers` : '\nall limits exported as numbers');
process.exit(failed ? 1 : 0);
