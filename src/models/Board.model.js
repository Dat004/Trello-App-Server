const mongoose = require("mongoose");

const BoardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Board phải có tiêu đề"],
    trim: true,
    maxlength: [100, "Tiêu đề không quá 100 ký tự"],
  },
  description: {
    type: String,
    default: "",
    trim: true,
  },
  color: {
    type: String,
    default: "bg-blue-500",
  },
  is_starred: {
    type: Boolean,
    default: false,
  },
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    default: null,
    index: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      role: {
        type: String,
        enum: ["admin", "member", "viewer"],
        default: "member",
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  visibility: {
    type: String,
    enum: ["private", "workspace", "public"],
    default: "workspace", // Mặc định khi trong workspace là workspace visibility
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
BoardSchema.pre("findOneAndUpdate", function () {
  this.set({ updated_at: Date.now() });
});

// Index hiệu quả
BoardSchema.index({ owner: 1, archived: 1 });
BoardSchema.index({ workspace: 1, archived: 1 });
BoardSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Board", BoardSchema);
