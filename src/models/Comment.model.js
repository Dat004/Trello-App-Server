const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Card",
    required: true,
    index: true,
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: [true, "Comment phải có nội dung"],
    trim: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null,
  },
  mentions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
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
CommentSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Indexing
CommentSchema.index({ card: 1, created_at: -1 });
CommentSchema.index({ board: 1 });
CommentSchema.index({ mentions: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
