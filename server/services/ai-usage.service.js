const db = require('../_helpers/db');
const Role = require('../_helpers/role');

/**
 * Daily per-account allowance for image generation.
 *
 * Image generation is by far the most expensive call in the AI tools, so it is
 * the one route that is metered. Set AI_IMAGE_DAILY_LIMIT to 0 to turn the cap
 * off entirely.
 */
const IMAGE_DAILY_LIMIT = Math.max(0, parseInt(process.env.AI_IMAGE_DAILY_LIMIT || '5', 10));

/** UTC so the reset time doesn't move with the server's locale. */
function today() {
    return new Date().toISOString().slice(0, 10);
}

function isExempt(user) {
    return user?.role === Role.Admin || user?.role === Role.SuperAdmin;
}

/**
 * Claims one image generation against today's allowance.
 *
 * The count is incremented before the image is generated so that simultaneous
 * requests can't both read "4 used" and each proceed. The filter only matches
 * while the account is under the limit; once it isn't, the upsert collides with
 * the unique index instead of inserting, which is how we detect exhaustion.
 *
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, remaining: number }>}
 */
async function claimImageGeneration(user) {
    if (!IMAGE_DAILY_LIMIT || isExempt(user)) {
        return { allowed: true, used: 0, limit: 0, remaining: Infinity };
    }

    const accountId = user.id;
    const day = today();

    try {
        const doc = await db.AiUsage.findOneAndUpdate(
            { accountId, day, imagesGenerated: { $lt: IMAGE_DAILY_LIMIT } },
            { $inc: { imagesGenerated: 1 }, $set: { updated: new Date() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        return {
            allowed: true,
            used: doc.imagesGenerated,
            limit: IMAGE_DAILY_LIMIT,
            remaining: Math.max(0, IMAGE_DAILY_LIMIT - doc.imagesGenerated)
        };
    } catch (err) {
        // Duplicate key means the row exists but is already at the limit.
        if (err?.code === 11000) {
            return { allowed: false, used: IMAGE_DAILY_LIMIT, limit: IMAGE_DAILY_LIMIT, remaining: 0 };
        }
        throw err;
    }
}

/** Hands back an allowance when the generation it was claimed for failed. */
async function releaseImageGeneration(user) {
    if (!IMAGE_DAILY_LIMIT || isExempt(user)) return;
    try {
        await db.AiUsage.updateOne(
            { accountId: user.id, day: today(), imagesGenerated: { $gt: 0 } },
            { $inc: { imagesGenerated: -1 } }
        );
    } catch (err) {
        // A refund failure must never mask the original generation error.
        console.error('[AI] could not release image quota:', err?.message || err);
    }
}

/** Current standing for the account, without consuming anything. */
async function getImageUsage(user) {
    if (!IMAGE_DAILY_LIMIT || isExempt(user)) {
        return { used: 0, limit: 0, remaining: Infinity, unlimited: true };
    }
    const doc = await db.AiUsage.findOne({ accountId: user.id, day: today() });
    const used = doc?.imagesGenerated || 0;
    return {
        used,
        limit: IMAGE_DAILY_LIMIT,
        remaining: Math.max(0, IMAGE_DAILY_LIMIT - used),
        unlimited: false
    };
}

module.exports = {
    IMAGE_DAILY_LIMIT,
    claimImageGeneration,
    releaseImageGeneration,
    getImageUsage
};
