const Workspace = require("../models/Workspace.model");
const User = require("../models/User.model");
const {
  kickMember,
  updateMemberRole,
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
    const { email: emailLower, role = "member" } = inviteMemberSchema.parse(
      req.body
    );

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

module.exports.updateMemberRole = async (req, res, next) => {
  try {
    const { member_id, role } = updateMemberRole.parse(req.body);
    const workspace = req.workspace;

    // Không cho phép cập nhật role owner
    if (workspace.owner.toString() === member_id) {
      const err = new Error("Không thể thay đổi role của owner workspace.");
      err.statusCode = 400;
      return next(err);
    }

    const currentMembers = workspace.members.filter(
      (m) => m.user.toString() !== member_id
    );
    const updatingMember = workspace.members.find(
      (m) => m.user.toString() === member_id
    );

    const isTargetAdmin = updatingMember.role === "admin";
    const isCurrentUserOwner =
      workspace.owner.toString() === req.user._id.toString();

    // Không cho phép Thăng / giáng cấp nếu cùng là admin
    if(isTargetAdmin && !isCurrentUserOwner) {
      const err = new Error("Chỉ owner mới có thể thay đổi role của admin khác.");
      err.statusCode = 400;
      return next(err);
    }

    updatingMember.role = role;
    const newWorkspace = await Workspace.findByIdAndUpdate(
      req.params.workspaceId,
      { $set: { members: [...currentMembers, updatingMember] } },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật role thành viên thành công",
      data: { workspace: newWorkspace },
    });
  } catch (err) {
    next(err);
  }
};

exports.kickMember = async (req, res, next) => {
  try {
    const { member_id } = kickMember.parse(req.body);
    const workspace = req.workspace;

    // Không cho kick owner
    if (workspace.owner.toString() === member_id) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa owner khỏi workspace",
      });
    }

    const memberIndex = workspace.members.findIndex(
      (m) => m.user.toString() === member_id
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Thành viên không tồn tại trong workspace",
      });
    }

    const targetMember = workspace.members[memberIndex];
    const isTargetAdmin = targetMember.role === "admin";
    const isCurrentUserOwner =
      workspace.owner.toString() === req.user._id.toString();

    // Chỉ owner mới kick được admin
    if (isTargetAdmin && !isCurrentUserOwner) {
      return res.status(403).json({
        success: false,
        message: "Chỉ owner mới có thể xóa admin khỏi workspace",
      });
    }

    // Xóa member
    workspace.members.splice(memberIndex, 1);

    const newWorkspace = await Workspace.findByIdAndUpdate(
      req.params.workspaceId,
      { $set: { members: [...workspace.members] } },
      { new: true, runValidators: true }
    )

    res.status(200).json({
      success: true,
      message: "Xóa thành viên khỏi workspace thành công",
      data: { newWorkspace },
    });
  } catch (error) {
    next(error);
  }
};
