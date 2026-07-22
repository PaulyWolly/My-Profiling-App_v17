const db = require('../_helpers/db');
const openaiService = require('./openai.service');

const MAX_MESSAGES = Math.max(20, parseInt(process.env.AI_CHAT_MAX_MESSAGES || '100', 10));
const MAX_FACTS = Math.max(20, parseInt(process.env.AI_MEMORY_MAX_FACTS || '80', 10));

function normalizeKey(key) {
    return String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 64);
}

function formatFactsForPrompt(facts) {
    if (!facts?.length) {
        return '';
    }

    const lines = facts.map((f) => {
        const label = f.key.replace(/_/g, ' ');
        return `- [${f.category}] ${label}: ${f.value}`;
    });

    return [
        'You are chatting with a returning logged-in user.',
        'The following long-term memory is AUTHORITATIVE about this user.',
        'When they ask who they are, their name, what they like, hobbies, or similar, answer directly from this memory.',
        'Do not say you do not know them if a matching fact is listed.',
        'Treat "secret" items as private — do not volunteer them unprompted; only use them if helpful and appropriate.',
        'Do not invent facts that are not listed.',
        'If the user corrects a fact, acknowledge and follow the correction.',
        '',
        'Known details about this user:',
        ...lines
    ].join('\n');
}

async function getConversation(accountId) {
    const doc = await db.AiConversation.findOne({ accountId }).lean();
    return doc?.messages || [];
}

async function appendConversation(accountId, userContent, assistantContent) {
    const now = new Date();
    const incoming = [
        { role: 'user', content: String(userContent || '').slice(0, 8000), createdAt: now },
        { role: 'assistant', content: String(assistantContent || '').slice(0, 16000), createdAt: now }
    ];

    let doc = await db.AiConversation.findOne({ accountId });
    if (!doc) {
        doc = new db.AiConversation({ accountId, messages: incoming, updated: now });
    } else {
        doc.messages = [...(doc.messages || []), ...incoming].slice(-MAX_MESSAGES);
        doc.updated = now;
    }
    await doc.save();
    return doc.messages;
}

async function clearConversation(accountId) {
    await db.AiConversation.findOneAndDelete({ accountId });
}

async function getMemory(accountId) {
    const doc = await db.AiMemory.findOne({ accountId }).lean();
    return doc?.facts || [];
}

async function upsertFacts(accountId, facts) {
    if (!Array.isArray(facts) || !facts.length) {
        return getMemory(accountId);
    }

    let doc = await db.AiMemory.findOne({ accountId });
    if (!doc) {
        doc = new db.AiMemory({ accountId, facts: [] });
    }

    const byKey = new Map((doc.facts || []).map((f) => [normalizeKey(f.key), f]));

    for (const raw of facts) {
        const key = normalizeKey(raw.key);
        const value = String(raw.value || '').trim().slice(0, 500);
        if (!key || !value) continue;

        const category = [
            'identity', 'preference', 'hobby', 'like', 'dislike', 'secret', 'other'
        ].includes(raw.category)
            ? raw.category
            : 'other';

        byKey.set(key, {
            key,
            value,
            category,
            updatedAt: new Date()
        });
    }

    doc.facts = Array.from(byKey.values())
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, MAX_FACTS);
    doc.updated = new Date();
    await doc.save();
    return doc.facts;
}

async function clearMemory(accountId) {
    await db.AiMemory.findOneAndDelete({ accountId });
}

async function deleteMemoryFact(accountId, key) {
    const normalized = normalizeKey(key);
    const doc = await db.AiMemory.findOne({ accountId });
    if (!doc) return [];
    doc.facts = (doc.facts || []).filter((f) => normalizeKey(f.key) !== normalized);
    doc.updated = new Date();
    await doc.save();
    return doc.facts;
}

/**
 * Ask the model to extract durable personal facts from the latest turn.
 * Failures are swallowed so chat still succeeds.
 */
async function extractAndStoreFacts(accountId, userMessage, assistantReply) {
    try {
        const extracted = await openaiService.extractUserMemoryFacts(userMessage, assistantReply);
        if (!extracted?.length) {
            return getMemory(accountId);
        }
        return await upsertFacts(accountId, extracted);
    } catch (err) {
        console.warn('[AiMemory] Fact extraction skipped:', err?.message || err);
        return getMemory(accountId);
    }
}

module.exports = {
    formatFactsForPrompt,
    getConversation,
    appendConversation,
    clearConversation,
    getMemory,
    upsertFacts,
    clearMemory,
    deleteMemoryFact,
    extractAndStoreFacts,
    MAX_MESSAGES,
    MAX_FACTS
};
