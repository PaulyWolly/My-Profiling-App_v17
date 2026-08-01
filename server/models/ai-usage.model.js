const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * One row per account per UTC day, counting billable AI calls.
 *
 * Kept in Mongo rather than memory because Render restarts and spins services
 * down, which would otherwise reset every allowance several times a day.
 */
const schema = new Schema({
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    /** UTC calendar day, YYYY-MM-DD. */
    day: { type: String, required: true },
    imagesGenerated: { type: Number, default: 0 },
    updated: { type: Date, default: Date.now }
});

// The quota check upserts against this pair, so it must reject duplicates for
// the "already at the limit" case to be detectable.
schema.index({ accountId: 1, day: 1 }, { unique: true });

// Yesterday's counters have no value once the day rolls over.
schema.index({ updated: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
        if (ret._id) ret.id = ret._id.toString();
        delete ret._id;
        return ret;
    }
});

module.exports = mongoose.model('AiUsage', schema);
