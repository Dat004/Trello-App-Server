const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const WorkspaceSchema = new Schema({
  name: {
    type: String,
    required: [true, "Workspace phải có tên"],
    trim: true,
    maxlength: [100, "Tên không quá 100 ký tự"],
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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
  max_members: {
    type: Number,
    default: 10, // Free workspace limit
    min: [5, "Giới hạn thành viên tối thiểu là 5"],
  },
  invites: [
    {
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
      role: {
        type: String,
        enum: ["admin", "member", "viewer"],
        default: "member",
      },
      invited_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      invited_at: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending",
      },
    },
  ],
  visibility: {
    type: String,
    enum: ["private", "public"],
    default: "private",
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
WorkspaceSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

WorkspaceSchema.index({ owner: 1 });
WorkspaceSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Workspace', WorkspaceSchema);
