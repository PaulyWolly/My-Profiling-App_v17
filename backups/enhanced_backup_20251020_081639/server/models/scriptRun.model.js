const mongoose = require('mongoose');

const scriptRunSchema = new mongoose.Schema({
  script: { type: String, required: true },
  executedBy: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['success', 'error'], required: true },
  output: { type: String },
  error: { type: String }
});

module.exports = mongoose.model('ScriptRun', scriptRunSchema); 