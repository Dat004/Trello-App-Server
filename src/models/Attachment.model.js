const mongoose = require("mongoose");

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

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
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    default: null,
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
  public_id: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    default: "file",
  },
  resource_type: {
    type: String,
    enum: ["image", "video", "raw", "auto"],
    default: "auto",
  },
  size: {
    type: Number,
    min: [0, "Size phải lớn hơn hoặc bằng 0"],
    max: [MAX_FILE_SIZE, "Size không được vượt quá 10MB"],
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
  deleted_at: {
    type: Date,
    default: null,
    index: true,
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

// Index cho query attachment theo card
AttachmentSchema.index({ deleted_at: 1 });
AttachmentSchema.index({ card: 1, created_at: -1, deleted_at: 1 });
AttachmentSchema.index({ board: 1, deleted_at: 1 });
AttachmentSchema.index({ workspace: 1, deleted_at: 1 });

module.exports = mongoose.model("Attachment", AttachmentSchema);
