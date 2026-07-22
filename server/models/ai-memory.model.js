const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const factSchema = new Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
    category: {
        type: String,
        enum: ['identity', 'preference', 'hobby', 'like', 'dislike', 'secret', 'other'],
        default: 'other'
    },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new Schema({
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true, index: true },
    facts: { type: [factSchema], default: [] },
    updated: { type: Date, default: Date.now }
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
        if (ret._id) ret.id = ret._id.toString();
        delete ret._id;
        return ret;
    }
});

module.exports = mongoose.model('AiMemory', schema);
