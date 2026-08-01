/**
 * Checks which questions route through web search. Search adds roughly 11
 * seconds per turn, so anything the model already knows should stay off it.
 *
 * No API calls are made.
 *
 *   node scripts/web-search-trigger-check.js ["your question"]
 */
const { needsWebSearch } = require('../services/openai.service');

if (process.argv[2]) {
    const question = process.argv[2];
    console.log(`"${question}" -> ${needsWebSearch(question) ? 'WEB SEARCH' : 'built-in knowledge'}`);
    return;
}

// Questions the model can answer from training data — these must stay fast.
const FAST = [
    'Hello',
    'hi there',
    'who am I and what do I like',
    'what is a limerick',
    'write me a limerick about coding',
    'tell me about the box jellyfish and provide images',
    'explain how JWT authentication works',
    'what is the capital of France',
    'how do I center a div in CSS',
    'summarize the plot of Hamlet'
];

// Questions that genuinely need fresher information than the model has.
const SEARCH = [
    'what is the latest news on AI regulation',
    'what is the weather in Austin today',
    'what is the current price of bitcoin',
    'who won the game last night',
    'search the web for Angular 20 release notes',
    'what happened in the 2026 election',
    'what is the stock price of NVDA',
    'is that restaurant open now',
    'what is the release date for the next iPhone',
    'show me recent headlines about Texas',
    // Sound timeless, but the answer changes — these must not be answered from memory
    'Who is POTUS',
    'who is the president',
    'who is the president of the United States',
    'who is the prime minister of the UK',
    'who is the CEO of Twitter',
    'who is the pope',
    'how old is Paul McCartney',
    'is Clint Eastwood still alive',
    'who owns Manchester United',
    'what is the world record for the marathon',
    'who is the richest person'
];

let failed = 0;

for (const question of FAST) {
    const hit = needsWebSearch(question);
    if (hit) failed += 1;
    console.log(`  ${hit ? 'FAIL' : 'ok  '}  fast    "${question}"`);
}

console.log('');

for (const question of SEARCH) {
    const hit = needsWebSearch(question);
    if (!hit) failed += 1;
    console.log(`  ${hit ? 'ok  ' : 'FAIL'}  search  "${question}"`);
}

const total = FAST.length + SEARCH.length;
console.log(`\n${total - failed}/${total} routed correctly`);
process.exitCode = failed ? 1 : 0;
