const mongoose = require('mongoose');
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
        'When you mention a remembered personal detail (name, hobby, like, etc.), wrap that exact value in double asterisks for bold, e.g. Your name is **Paul**.',
        'When listing multiple likes or foods, write natural English with commas and "and" — never a slash. Example: **lacto-fermented pickles**, **olives** and **avocados**.',
        'Wrong: avocados/olives or pickled things/avocados. Right: pickled things, olives and avocados.',
        'Treat "secret" items as private — do not volunteer them unprompted; only use them if helpful and appropriate.',
        'Do not invent facts that are not listed.',
        'If the user corrects a fact, acknowledge and follow the correction.',
        '',
        'Known details about this user:',
        ...lines
    ].join('\n');
}

const MAX_CONVERSATIONS = Math.max(5, parseInt(process.env.AI_CHAT_MAX_CONVERSATIONS || '50', 10));

let conversationIndexesReady = false;

/** Older installs had one transcript per account (unique accountId). */
async function ensureConversationIndexes() {
    if (conversationIndexesReady) return;
    conversationIndexesReady = true;
    try {
        await db.AiConversation.collection.dropIndex('accountId_1');
    } catch {
        /* already dropped, or never unique */
    }
}

function asObjectId(value) {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
    return new mongoose.Types.ObjectId(String(value));
}

function titleFromMessage(text) {
    const title = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 72);
    return title || 'New chat';
}

function conversationPreview(messages) {
    const firstUser = (messages || []).find((m) => m.role === 'user');
    return String(firstUser?.content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
}

function toConversationJson(doc) {
    if (!doc) {
        return { id: '', title: 'New chat', messages: [] };
    }
    const id = doc.id || (doc._id ? String(doc._id) : '');
    return {
        id,
        title: doc.title || 'New chat',
        updated: doc.updated,
        created: doc.created,
        messages: doc.messages || []
    };
}

async function listConversations(accountId) {
    await ensureConversationIndexes();
    const docs = await db.AiConversation.find({ accountId })
        .select({ title: 1, updated: 1, created: 1, messages: { $slice: 2 } })
        .sort({ updated: -1 })
        .limit(MAX_CONVERSATIONS)
        .lean();

    return docs.map((doc) => ({
        id: String(doc._id),
        title: doc.title || 'New chat',
        updated: doc.updated,
        created: doc.created,
        preview: conversationPreview(doc.messages)
    }));
}

async function getConversation(accountId, conversationId) {
    await ensureConversationIndexes();
    if (conversationId) {
        const id = asObjectId(conversationId);
        if (!id) {
            return toConversationJson(null);
        }
        const doc = await db.AiConversation.findOne({ _id: id, accountId }).lean();
        return toConversationJson(doc);
    }
    const doc = await db.AiConversation.findOne({ accountId }).sort({ updated: -1 }).lean();
    return toConversationJson(doc);
}

async function getConversationMessages(accountId, conversationId) {
    const convo = await getConversation(accountId, conversationId);
    return convo.messages || [];
}

async function trimConversationCount(accountId) {
    const extras = await db.AiConversation.find({ accountId })
        .select('_id')
        .sort({ updated: -1 })
        .skip(MAX_CONVERSATIONS)
        .lean();
    if (!extras.length) return;
    await db.AiConversation.deleteMany({ _id: { $in: extras.map((d) => d._id) } });
}

/**
 * Appends a turn in one atomic update rather than reading the document,
 * editing it, and writing it back. Saves now happen after the reply has been
 * sent, so two quick turns can overlap; $push lets the database merge them
 * instead of the second save overwriting the first.
 *
 * Pass conversationId to keep adding to that thread. Omit it to start a new one.
 */
async function appendConversation(accountId, userContent, assistantContent, conversationId) {
    await ensureConversationIndexes();
    const now = new Date();
    const incoming = [
        { role: 'user', content: String(userContent || '').slice(0, 8000), createdAt: now },
        { role: 'assistant', content: String(assistantContent || '').slice(0, 16000), createdAt: now }
    ];
    const title = titleFromMessage(userContent);
    const id = asObjectId(conversationId);

    if (id) {
        const existing = await db.AiConversation.findOneAndUpdate(
            { _id: id, accountId },
            {
                $push: { messages: { $each: incoming, $slice: -MAX_MESSAGES } },
                $set: { updated: now }
            },
            { new: true }
        );
        if (existing) {
            return { id: existing.id, title: existing.title || title };
        }
    }

    const created = await db.AiConversation.create({
        accountId,
        title,
        messages: incoming,
        created: now,
        updated: now
    });
    await trimConversationCount(accountId);
    return { id: created.id, title: created.title || title };
}

async function deleteConversation(accountId, conversationId) {
    const id = asObjectId(conversationId);
    if (!id) {
        return false;
    }
    const result = await db.AiConversation.findOneAndDelete({ _id: id, accountId });
    return !!result;
}

async function clearConversation(accountId) {
    const latest = await db.AiConversation.findOne({ accountId }).sort({ updated: -1 }).select('_id').lean();
    if (!latest) return;
    await db.AiConversation.findOneAndDelete({ _id: latest._id, accountId });
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
    listConversations,
    getConversation,
    getConversationMessages,
    appendConversation,
    deleteConversation,
    clearConversation,
    getMemory,
    upsertFacts,
    clearMemory,
    deleteMemoryFact,
    extractAndStoreFacts,
    MAX_MESSAGES,
    MAX_FACTS,
    MAX_CONVERSATIONS
};
