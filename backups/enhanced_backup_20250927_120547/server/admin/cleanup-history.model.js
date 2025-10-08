const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    timestamp: { type: Date, required: true },
    executedBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    executedByEmail: { type: String, required: true },
    sessionsCleaned: { type: Number, required: true },
    tokensRevoked: { type: Number, required: true },
    executionTime: { type: Number, required: true },
    result: { type: String, required: true },
    isAutomatic: { type: Boolean, default: false },
    ipAddress: { type: String, required: true }
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('CleanupHistory', schema); 