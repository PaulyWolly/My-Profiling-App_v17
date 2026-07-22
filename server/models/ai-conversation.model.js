const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new Schema({
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true, index: true },
    messages: { type: [messageSchema], default: [] },
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

module.exports = mongoose.model('AiConversation', schema);
