const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Card phải có tiêu đề'],
    trim: true,
    maxlength: [200, 'Tiêu đề không quá 200 ký tự'],
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  list: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: true,
    index: true,
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
    index: true,
  },
  order: {
    type: Number,
    required: true,
  },
  due_date: {
    type: Date,
    default: null,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  labels: [{
    name: String,
    color: String,
  }],
  checklist: [{
    text: String,
    completed: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  comments: [{
    text: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reply_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Card.comments' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    created_at: { type: Date, default: Date.now },
  }],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    message: String,
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    created_at: { type: Date, default: Date.now },
  }],
  archived: {
    type: Boolean,
    default: false,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Auto update updated_at
CardSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: Date.now() });
  next();
});

// Indexing
CardSchema.index({ list: 1, order: 1 });
CardSchema.index({ board: 1, archived: 1 });
CardSchema.index({ members: 1 });
CardSchema.index({ due_date: 1 });
CardSchema.index({ 'comments.mentions': 1 });

module.exports = mongoose.model('Card', CardSchema);