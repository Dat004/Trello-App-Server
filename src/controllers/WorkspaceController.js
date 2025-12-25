const Workspace = require("../models/Workspace.model");
const User = require("../models/User.model");
const {
  inviteMemberSchema,
  updateWorkspaceSchema,
  updatePermissionsSchema,
} = require("../utils/validationSchemas");

// Tạo workspace mới
module.exports.create = async (req, res, next) => {
  try {
    const { name, description, color, visibility, maxMembers } = req.body;

    const newWorkspace = await Workspace.create({
      name,
      description: description || "",
      color: color || "bg-blue-500",
      visibility: visibility || "private",
      maxMembers: maxMembers || 10,
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    });

    res.status(201).json({
      success: true,
      message: "Tạo workspace thành công",
      data: { workspace: newWorkspace },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả các workspaces
module.exports.getMyWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách workspace thành công",
      data: { workspaces },
    });
  } catch (error) {
    next(error);
  }
};

// GET tất cả thành viên trong workspace
module.exports.getWorkspaceMembers = async (req, res, next) => {
  try {
    const workspace = req.workspace;

    res.status(200).json({
      success: true,
      message: "Lấy danh sách thành viên thành công",
      data: {
        members: workspace.members,
        owner: workspace.owner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE thông tin workspace (name, description, color, visibility, maxMembers)
module.exports.updateWorkspace = async (req, res, next) => {
  try {
    const validatedData = updateWorkspaceSchema.parse(req.body);

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      req.params.workspaceId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật workspace thành công",
      data: { workspace: updatedWorkspace },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE permission workspace
module.exports.updatePermissions = async (req, res, next) => {
  try {
    const validatedData = updatePermissionsSchema.parse(req.body);

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      req.params.workspaceId,
      { $set: { permissions: { ...validatedData } } },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật quyền hạn thành công",
      data: { workspace: updatedWorkspace },
    });
  } catch (error) {
    next(error);
  }
};

exports.inviteMember = async (req, res, next) => {
  try {
    const { email: emailLower, role = "member" } = inviteMemberSchema.parse(req.body);

    const workspace = req.workspace;

    // Kiểm tra email đã tồn tại trong hệ thống (có user)
    const invitedUser = await User.findOne({ email: emailLower });
    if (!invitedUser) {
      return res.status(400).json({
        success: false,
        message: "Email này chưa được đăng ký. Không thể gửi lời mời.",
      });
    }

    // Kiểm tra quyền mời thành viên theo permissions + role hiện tại
    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const currentMember = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );
    const userRole = isOwner
      ? "admin"
      : currentMember
      ? currentMember.role
      : null;

    const allowedInvite =
      workspace.permissions.canInviteMember === "admin_member"
        ? ["admin", "member"]
        : ["admin"];

    if (!isOwner && !allowedInvite.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền mời thành viên vào workspace này",
      });
    }

    // Check trùng
    const existingMember = workspace.members.find(
      (m) => m.user.toString() === invitedUser._id.toString()
    );
    const existingInvite = workspace.invites.find(
      (i) => i.email === emailLower && i.status === "pending"
    );

    if (existingMember || existingInvite) {
      return res.status(400).json({
        success: false,
        message: "Người dùng này đã tham gia hoặc đã được mời",
      });
    }

    // Check giới hạn
    const pendingCount = workspace.invites.filter(
      (i) => i.status === "pending"
    ).length;
    if (workspace.members.length + pendingCount >= workspace.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Workspace đã đạt giới hạn thành viên",
      });
    }

    workspace.invites.push({
      email: emailLower,
      role,
      invited_by: req.user._id,
    });

    await workspace.save();

    res.status(200).json({
      success: true,
      message: "Gửi lời mời thành công",
      data: { workspace },
    });
  } catch (error) {
    next(error);
  }
};
