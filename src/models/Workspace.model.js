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
    max: [50, "Giới hạn thành viên tối đa là 50"],
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
  join_requests: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      message: {
        type: String,
        trim: true,
        maxlength: [200, "Lời nhắn không quá 200 ký tự"],
        default: "",
      },
      requested_at: {
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
  permissions: {
    canCreateBoard: {
      type: String,
      enum: ["admin_only", "admin_member"], // Chỉ admin hoặc admin + member được mời
      default: "admin_member", // Mặc định admin + member được tạo board
    },
    canInviteMember: {
      type: String,
      enum: ["admin_only", "admin_member"], // Chỉ admin hoặc admin + member được mời
      default: "admin_only", // Mặc định chỉ admin được mời
    },
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
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

// Auto update updated_at
WorkspaceSchema.pre("save", function () {
  this.updated_at = Date.now();
});

WorkspaceSchema.index({ deleted_at: 1 });
WorkspaceSchema.index({ owner: 1, deleted_at: 1 });
WorkspaceSchema.index({ 'members.user': 1, deleted_at: 1 });

module.exports = mongoose.model("Workspace", WorkspaceSchema);
