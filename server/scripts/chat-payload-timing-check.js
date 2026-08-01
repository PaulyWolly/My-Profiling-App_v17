/**
 * Times a chat reply against payloads of increasing size, to show how much of a
 * slow turn comes from the question itself versus the conversation history and
 * stored memory facts that the browser sends along with it.
 *
 *   node scripts/chat-payload-timing-check.js ["your message"]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'secrets', '.env') });

const openaiService = require('../services/openai.service');

const MESSAGE = process.argv[2] || 'Who is POTUS';

const SAMPLE_FACTS = [
    'name: Paul Welby',
    'location: Texas',
    'occupation: full stack developer',
    'stack: Angular, Node, MongoDB',
    'diet: lacto-fermented pickles, olives, avocados',
    'interests: AI agentic frameworks, Neo4j, GraphQL'
].map((f) => `- ${f}`).join('\n');

const SAMPLE_HISTORY = [
    ['Hello', 'Hi Paul, good to see you again. What can I help with?'],
    ['What are some AI agentic frameworks?', 'Popular ones include LangChain, CrewAI, AutoGen, and Flowise.'],
    ['Show me pictures of a king cobra', 'Here are photos of the king cobra (Ophiophagus hannah).'],
    ['Tell me about Neo4j', 'Neo4j stores data as a labeled property graph of nodes and relationships.']
];

function buildMessages(turns) {
    const messages = [];
    for (let i = 0; i < turns; i += 1) {
        const [user, assistant] = SAMPLE_HISTORY[i % SAMPLE_HISTORY.length];
        messages.push({ role: 'user', content: user });
        messages.push({ role: 'assistant', content: assistant });
    }
    messages.push({ role: 'user', content: MESSAGE });
    return messages;
}

async function run(label, messages, memorySystemContent) {
    const started = Date.now();
    let note = '';
    try {
        const reply = await openaiService.chat(messages, { memorySystemContent });
        note = String(reply || '').replace(/\s+/g, ' ').slice(0, 60);
    } catch (err) {
        note = `FAILED: ${err && err.message ? err.message : err}`;
    }
    const ms = Date.now() - started;
    console.log(`  ${label.padEnd(34)} ${String(ms).padStart(6)} ms   ${note}...`);
    return ms;
}

(async () => {
    console.log(`message = "${MESSAGE}"`);
    console.log(`model   = ${openaiService.getChatConfig().model}\n`);

    await run('bare question, no history', buildMessages(0), '');
    await run('+ memory facts', buildMessages(0), SAMPLE_FACTS);
    await run('+ memory + 4 turns of history', buildMessages(4), SAMPLE_FACTS);
    await run('+ memory + 8 turns of history', buildMessages(8), SAMPLE_FACTS);
})();
