const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const galleryItemSchema = new Schema({
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    caption: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

galleryItemSchema.index({ accountId: 1, createdAt: -1 });

galleryItemSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
    }
});

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
