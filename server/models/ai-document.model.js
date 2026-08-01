const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chunkSchema = new Schema({
    text: { type: String, required: true },
    /** Page this text came from, so an answer can show that page's pictures. */
    page: { type: Number },
    embedding: { type: [Number], default: [] }
}, { _id: false });

/**
 * A picture found in the document. The image itself lives in S3 — a document is
 * capped at 16MB in Mongo and the embeddings already crowd that budget.
 */
const imageSchema = new Schema({
    page: { type: Number, required: true },
    url: { type: String, required: true },
    width: Number,
    height: Number
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
    images: [imageSchema],
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
