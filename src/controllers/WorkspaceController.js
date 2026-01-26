const { deleteWorkspace } = require("../services/workspace/delete");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
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
    const { name, description, color, max_members } = req.body;

    const newWorkspace = await Workspace.create({
      name,
      description: description,
      color: color,
      max_members: max_members,
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    });

    res.status(201).json({
      success: true,
      message: "Tạo workspace thành công",
      data: {
        workspace: {
          ...newWorkspace.toObject(),
          board_count: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả các workspaces
module.exports.getMyWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.aggregate([
      // Lấy workspaces mà user là owner hoặc là member
      {
        $match: {
          deleted_at: null,
          $or: [
            { owner: req.user._id, deleted_at: null },
            { "members.user": req.user._id },
          ],
        },
      },

      // Join với Board để lấy các board thuộc workspace này
      {
        $lookup: {
          from: "boards",
          localField: "_id",
          foreignField: "workspace",
          as: "boards",
        },
      },

      // Số lượng board
      {
        $addFields: {
          board_count: { $size: "$boards" },
        },
      },

      {
        $unset: "boards", // Xóa boards
      },

      {
        $sort: { updated_at: -1 },
      },
    ]);

    // Join với User để lấy thông tin thành viên
    await Workspace.populate(workspaces, 
      {
        path: "members.user",
        select: "_id full_name avatar.url email",
      }
    );
    await Workspace.populate(workspaces, 
      {
        path: "join_requests.user",
        select: "_id full_name avatar.url email",
      }
    );

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
    const workspace = await Workspace.findOne({
      _id: req.params.workspaceId,
      deleted_at: null,
    }).populate("members.user", "avatar full_name email");
    const validMembers = workspace.members.filter((m) => m.user !== null);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách thành viên thành công",
      data: {
        members: validMembers,
        owner: workspace.owner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE thông tin workspace (name, description, color, visibility, max_members)
module.exports.updateWorkspace = async (req, res, next) => {
  try {
    const validatedData = updateWorkspaceSchema.parse(req.body);

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      {
        _id: req.params.workspaceId,
        deleted_at: null,
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    const boardCount = await Board.countDocuments({
      workspace: req.params.workspaceId,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật workspace thành công",
      data: {
        workspace: {
          ...updatedWorkspace.toObject(),
          board_count: boardCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// SOFT DELETE workspace
module.exports.delete = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const workspace = req.workspace;
    const user = req.user;

    // Kiểm tra quyền (Authorization)
    if (!workspace.owner.equals(user._id)) {
      const err = new Error("Bạn không có quyền xóa workspace này");
      err.statusCode = 403;
      return next(err);
    }

    await deleteWorkspace(workspaceId, {
      actor: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Xóa workspace thành công.",
    });
  } catch (err) {
    next(err);
  }
};

// UPDATE permission workspace
module.exports.updatePermissions = async (req, res, next) => {
  try {
    const validatedData = updatePermissionsSchema.parse(req.body);

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      {
        _id: req.params.workspaceId,
        deleted_at: null,
      },
      { $set: { permissions: validatedData } },
      { new: true, runValidators: true }
    ).select("permissions");

    res.status(200).json({
      success: true,
      message: "Cập nhật quyền hạn thành công",
      data: {
        permissions: updatedWorkspace.permissions,
      },
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
    if (workspace.members.length + pendingCount >= workspace.max_members) {
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

    const updatingMember = workspace.members.find(
      (m) => m.user.toString() === member_id
    );

    const isTargetAdmin = updatingMember.role === "admin";
    const isCurrentUserOwner =
      workspace.owner.toString() === req.user._id.toString();

    // Không cho phép Thăng / giáng cấp nếu cùng là admin
    if (isTargetAdmin && !isCurrentUserOwner) {
      const err = new Error(
        "Chỉ owner mới có thể thay đổi role của admin khác."
      );
      err.statusCode = 400;
      return next(err);
    }

    await Workspace.updateOne(
      {
        _id: req.params.workspaceId,
        "members.user": member_id,
      },
      {
        $set: {
          "members.$.role": role,
        },
      }
    );

    // Trả về gọn nhẹ
    res.status(200).json({
      success: true,
      message: "Cập nhật role thành công",
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
    const result = await Workspace.updateOne(
      { _id: req.params.workspaceId },
      {
        $pull: {
          members: { user: member_id },
        },
      }
    );

    // Không cần trả về data mới, chỉ cần báo thành công
    res.status(200).json({
      success: true,
      message: "Xóa thành viên thành công",
    });
  } catch (error) {
    next(error);
  }
};

// Gửi yêu cầu tham gia workspace
exports.sendJoinRequest = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    const workspace = await Workspace.findOne({ _id: workspaceId, deleted_at: null });
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace không tồn tại" });
    }

    // // Chỉ cho phép gửi yêu cầu nếu workspace là công khai (public)
    // if (workspace.visibility !== "public") {
    //   return res.status(403).json({ success: false, message: "Workspace này là riêng tư, không thể gửi yêu cầu tham gia" });
    // }

    // Kiểm tra xem user đã là thành viên chưa
    const isMember = workspace.members.some(m => m.user.equals(userId));
    if (isMember) {
      return res.status(400).json({ success: false, message: "Bạn đã là thành viên của workspace này" });
    }

    // Kiểm tra xem user có đang được mời không
    const userEmail = req.user.email;
    const isInvited = workspace.invites.some(i => i.email === userEmail && i.status === "pending");
    if (isInvited) {
      return res.status(400).json({ success: false, message: "Bạn đang có một lời mời tham gia workspace này, hãy kiểm tra thông báo" });
    }

    // Kiểm tra xem user đã gửi yêu cầu tham gia chưa
    const hasPendingRequest = workspace.join_requests.some(
      r => r.user.toString() === userId.toString() && r.status === "pending"
    );
    if (hasPendingRequest) {
      return res.status(400).json({ success: false, message: "Bạn đã gửi yêu cầu tham gia và đang chờ duyệt" });
    }

    workspace.join_requests.push({
      user: userId,
      message: message || "",
      status: "pending",
    });

    await workspace.save();

    res.status(200).json({
      success: true,
      message: "Gửi yêu cầu tham gia thành công",
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách yêu cầu tham gia (chỉ admin/owner mới được xem)
exports.getJoinRequests = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findOne({ _id: workspaceId, deleted_at: null })
      .populate("join_requests.user", "full_name email avatar.url");

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace không tồn tại" });
    }

    // Lọc ra các yêu cầu tham gia đang chờ duyệt
    const pendingRequests = workspace.join_requests.filter(r => r.status === "pending");

    res.status(200).json({
      success: true,
      data: { join_requests: pendingRequests },
    });
  } catch (error) {
    next(error);
  }
};

// Xử lý yêu cầu tham gia (Accept/Decline)
exports.handleJoinRequest = async (req, res, next) => {
  try {
    const { workspaceId, requestId } = req.params;
    const { status } = req.body; // 'accepted' hoặc 'declined'

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const workspace = await Workspace.findOne({ _id: workspaceId, deleted_at: null });
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace không tồn tại" });
    }

    // Tìm yêu cầu trong mảng join_requests
    const request = workspace.join_requests.id(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Yêu cầu không tồn tại hoặc đã được xử lý" });
    }

    let newMember = null;
    const targetUserId = request.user._id;

    if (status === "accepted") {
      // Kiểm tra xem người này có VỪA MỚI trở thành member không
      const isAlreadyMember = workspace.members.some(m => m.user.equals(targetUserId));
      if (isAlreadyMember) {
        // Nếu đã là member rồi thì chỉ cần xóa yêu cầu tham gia đi
        workspace.join_requests.pull(requestId);
        await workspace.save();
        return res.status(400).json({ success: false, message: "Người dùng này đã là thành viên của workspace" });
      }

      // Kiểm tra giới hạn thành viên
      if (workspace.members.length >= workspace.max_members) {
        return res.status(400).json({ success: false, message: "Workspace đã đạt giới hạn thành viên" });
      }
      
      // Thêm vào mảng members
      newMember = {
        user: targetUserId,
        role: "member",
        joinedAt: new Date(),
      };
      workspace.members.push(newMember);

      // Tìm email của user này để xóa trong mảng invites (nếu có)
      const targetUser = await User.findById(targetUserId);
      if (targetUser) {
        workspace.invites = workspace.invites.filter(i => i.email !== targetUser.email);
      }
    }

    // Xóa yêu cầu này khỏi danh sách chờ để dọn dẹp
    workspace.join_requests.pull(requestId);

    await workspace.save();

    // Nếu đồng ý, ta cần populate thông tin user cho member mới để trả về cho FE
    if (status === "accepted" && newMember) {
      // Lấy member mới nhất từ mảng members (để có đầy đủ logic ID của mongoose nếu cần)
      // Hoặc đơn giản là dùng bản object vừa tạo và populate nó
      const populatedWorkspace = await Workspace.populate(workspace, {
        path: "members.user",
        select: "_id full_name avatar.url email",
      });

      // Tìm member vừa được thêm vào trong mảng đã populate
      const addedMember = populatedWorkspace.members.find(m => m.user._id.equals(targetUserId));

      return res.status(200).json({
        success: true,
        message: "Đã chấp nhận yêu cầu tham gia",
        data: { member: addedMember }
      });
    }

    res.status(200).json({
      success: true,
      message: "Đã từ chối yêu cầu tham gia",
    });
  } catch (error) {
    next(error);
  }
};
