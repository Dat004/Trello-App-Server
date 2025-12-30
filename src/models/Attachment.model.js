const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: "file",
  },
  size: {
    type: Number,
    default: 0,
  },
  message: {
    type: String,
    default: "",
    trim: true,
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

// Index cho query attachment theo card
AttachmentSchema.index({ card: 1, created_at: -1 });
AttachmentSchema.index({ board: 1 });

module.exports = mongoose.model("Attachment", AttachmentSchema);
