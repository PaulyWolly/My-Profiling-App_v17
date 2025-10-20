const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const replySchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  replies: [replySchema],
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 }
});

postSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Post', postSchema); 