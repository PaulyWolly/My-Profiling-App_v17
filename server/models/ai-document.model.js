const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chunkSchema = new Schema({
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] }
}, { _id: false });

const schema = new Schema({
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    filename: String,
    originalName: { type: String, required: true },
    mimeType: String,
    charCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    embeddingModel: { type: String, default: 'text-embedding-ada-002' },
    chunks: [chunkSchema],
    uploaded: { type: Date, default: Date.now }
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
        if (ret._id) ret.id = ret._id.toString();
        delete ret._id;
        delete ret.chunks;
        delete ret.embedding;
        return ret;
    }
});

module.exports = mongoose.model('AiDocument', schema);
