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
  pos: {
    type: Number,
    required: true,
    default: 0,
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
  }, {
    _id: true
  }],
  checklist: [{
    text: String,
    completed: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  }, {
    _id: true
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
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
cardSchema.index({ list: 1, pos: 1 });
cardSchema.index({ board: 1, archived: 1 });
cardSchema.index({ members: 1 });
cardSchema.index({ due_date: 1 });

module.exports = mongoose.model('Card', CardSchema);