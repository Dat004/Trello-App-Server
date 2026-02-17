const WorkspaceMembershipService = require("../services/membership/workspace.service");
const withTransaction = require('../services/common/withTransaction');
const { deleteWorkspace } = require("../services/workspace/delete");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const {
  kickMember,
  updateMemberRole,
  inviteMemberSchema,
  updateWorkspaceSchema,
  updatePermissionsSchema,
} = require("../utils/validationSchemas");
const { emitToRoom } = require("../utils/socketHelper");
const {
  logWorkspaceCreated,
  logWorkspaceUpdated,
  logWorkspaceDeleted,
  logPermissionChanged,
  logBoardMovedToWorkspace,
  logBoardRemovedFromWorkspace,
} = require("../services/activity/log");

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

    // Populate members để lấy thông tin user
    await newWorkspace.populate("members.user", "_id full_name avatar.url email");

    // Log activity
    logWorkspaceCreated(newWorkspace, req.user._id);

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
      // Join với Board để lấy số lượng board chưa xóa
      {
        $lookup: {
          from: "boards",
          let: { workspaceId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$workspace", "$$workspaceId"] },
                deleted_at: null,
              },
            },
            { $count: "count" },
          ],
          as: "board_count_data",
        },
      },

      // Lấy giá trị count từ mảng kết quả
      {
        $addFields: {
          board_count: {
            $ifNull: [{ $arrayElemAt: ["$board_count_data.count", 0] }, 0],
          },
        },
      },

      {
        $project: {
          board_count_data: 0,
        },
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

// GET chi tiết workspace theo ID
module.exports.getWorkspaceById = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    // Lấy workspace và populate thông tin
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      deleted_at: null,
    })
      .populate("members.user", "_id full_name avatar.url email")
      .populate("join_requests.user", "_id full_name avatar.url email")

    if (!workspace) {
      const error = new Error("Workspace không tồn tại");
      error.statusCode = 404;
      return next(error);
    }

    // Kiểm tra membership status của user hiện tại
    const isOwner = workspace.owner._id.equals(req.user._id);
    const memberRecord = workspace.members.find((m) =>
      m.user && m.user._id.equals(req.user._id)
    );
    const isMember = isOwner || !!memberRecord;

    // Nếu user chưa là member
    if (!isMember) {
      // Nếu là Public Workspace -> Xem Full (Read-only)
      if (workspace.visibility === 'public') {
        const boardCount = await Board.countDocuments({
          workspace: workspaceId,
          deleted_at: null,
          $or: [{ visibility: 'public' }, { visibility: 'workspace' }] // Guest xem được public & workspace boards
        });

        const workspaceData = workspace.toObject();
        workspaceData.board_count = boardCount;

        return res.status(200).json({
          success: true,
          message: "Lấy chi tiết workspace thành công (Public Mode)",
          data: {
            workspace: workspaceData,
            is_member: false,
            read_only: true // Flag để FE disable nút sửa
          },
        });
      }

      // Nếu là Private -> Trả về Preview
      const pendingRequest = workspace.join_requests.find(
        (jr) => jr.user && jr.user._id.equals(req.user._id) && jr.status === "pending"
      );

      return res.status(200).json({
        success: true,
        message: "Lấy thông tin workspace thành công",
        data: {
          workspace: {
            _id: workspace._id,
            name: workspace.name,
            description: workspace.description,
            visibility: workspace.visibility, // Thêm visibility
            owner: {
              _id: workspace.owner._id,
              full_name: workspace.owner.full_name,
              avatar: workspace.owner.avatar
            }
          },
          is_member: false,
          has_pending_request: !!pendingRequest,
          requested_at: pendingRequest ? pendingRequest.requested_at : null,
        },
      });
    }

    // User là member, trả về thông tin đầy đủ
    const boardCount = await Board.countDocuments({
      workspace: workspaceId,
      deleted_at: null,
    });

    const workspaceData = workspace.toObject();
    workspaceData.board_count = boardCount;

    res.status(200).json({
      success: true,
      message: "Lấy chi tiết workspace thành công",
      data: {
        workspace: workspaceData,
        is_member: true
      },
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

    // Lấy workspace cũ để track changes
    const oldWorkspace = await Workspace.findOne({
      _id: req.params.workspaceId,
      deleted_at: null,
    });

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      {
        _id: req.params.workspaceId,
        deleted_at: null,
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    // Log activity with changes
    const changes = {};
    if (validatedData.name && oldWorkspace.name !== validatedData.name) {
      changes.name = { from: oldWorkspace.name, to: validatedData.name };
    }
    if (validatedData.description !== undefined && oldWorkspace.description !== validatedData.description) {
      changes.description = { from: oldWorkspace.description, to: validatedData.description };
    }
    if (validatedData.color && oldWorkspace.color !== validatedData.color) {
      changes.color = { from: oldWorkspace.color, to: validatedData.color };
    }
    if (validatedData.visibility && oldWorkspace.visibility !== validatedData.visibility) {
      changes.visibility = { from: oldWorkspace.visibility, to: validatedData.visibility };
    }
    if (validatedData.max_members !== undefined && oldWorkspace.max_members !== validatedData.max_members) {
      changes.max_members = { from: oldWorkspace.max_members, to: validatedData.max_members };
    }
    if (Object.keys(changes).length > 0) {
      logWorkspaceUpdated(updatedWorkspace, req.user._id, changes);
    }

    await Workspace.populate(updatedWorkspace,
      {
        path: "members.user",
        select: "_id full_name avatar.url email",
      }
    );
    await Workspace.populate(updatedWorkspace,
      {
        path: "join_requests.user",
        select: "_id full_name avatar.url email",
      }
    );

    // Socket emit
    emitToRoom({
      room: `workspace:${req.params.workspaceId}`,
      event: "workspace-updated",
      data: updatedWorkspace,
      socketId: req.headers["x-socket-id"],
    });

    const boardCount = await Board.countDocuments({
      workspace: req.params.workspaceId,
      deleted_at: null,
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

    // Log activity
    logWorkspaceDeleted(workspace, user._id);

    // Socket emit - notify workspace members that workspace is deleted
    emitToRoom({
      room: `workspace:${workspaceId}`,
      event: "workspace-deleted",
      data: workspaceId,
      socketId: req.headers["x-socket-id"],
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

    // Lấy old permissions để track changes
    const oldWorkspace = await Workspace.findOne({
      _id: req.params.workspaceId,
      deleted_at: null,
    });

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      {
        _id: req.params.workspaceId,
        deleted_at: null,
      },
      { $set: { permissions: validatedData } },
      { new: true, runValidators: true }
    ).select("permissions");

    // Log permission changes
    const changes = {};
    if (oldWorkspace.permissions.canCreateBoard !== validatedData.canCreateBoard) {
      changes.canCreateBoard = {
        from: oldWorkspace.permissions.canCreateBoard,
        to: validatedData.canCreateBoard
      };
    }
    if (oldWorkspace.permissions.canInviteMember !== validatedData.canInviteMember) {
      changes.canInviteMember = {
        from: oldWorkspace.permissions.canInviteMember,
        to: validatedData.canInviteMember
      };
    }
    if (Object.keys(changes).length > 0) {
      logPermissionChanged(oldWorkspace, req.user._id, changes);
    }

    // Socket emit
    emitToRoom({
      room: `workspace:${req.params.workspaceId}`,
      event: "workspace-permissions-updated",
      data: { workspaceId: req.params.workspaceId, permissions: updatedWorkspace.permissions },
      socketId: req.headers["x-socket-id"],
    });

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

    const updatedWorkspace = await WorkspaceMembershipService.inviteMember(
      workspace,
      req.user,
      emailLower,
      role
    );

    res.status(200).json({
      success: true,
      message: "Gửi lời mời thành công",
      data: { workspace: updatedWorkspace },
    });
  } catch (error) {
    if (error.message.includes("không có quyền") || error.message.includes("giới hạn")) {
      error.statusCode = 400;
    }
    next(error);
  }
};

module.exports.updateMemberRole = async (req, res, next) => {
  try {
    const { member_id, role } = updateMemberRole.parse(req.body);
    const workspace = req.workspace;

    await WorkspaceMembershipService.updateMemberRole(
      workspace,
      req.user,
      member_id,
      role
    );

    emitToRoom({
      room: `workspace:${workspace._id}`,
      event: "member-role-updated",
      data: { workspaceId: workspace._id, memberId: member_id, role },
      socketId: req.headers["x-socket-id"]
    });

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

    await WorkspaceMembershipService.kickMember(
      workspace,
      req.user,
      member_id
    );

    emitToRoom({
      room: `workspace:${workspace._id}`,
      event: "member-removed",
      data: { workspaceId: workspace._id, member_id, userId: member_id },
      socketId: req.headers["x-socket-id"]
    });

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

    // Populate user info for socket event
    await workspace.populate({
      path: "join_requests.user",
      select: "_id full_name email avatar.url"
    });

    const newRequest = workspace.join_requests[workspace.join_requests.length - 1];

    // Emit socket event to workspace admins
    emitToRoom({
      room: `workspace:${workspace._id}`,
      event: "join-request-received",
      data: { workspaceId: workspace._id, joinRequest: newRequest },
      socketId: req.headers["x-socket-id"]
    });

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
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' hoặc 'declined'

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const workspace = req.workspace;

    if (status === "accepted") {
      const { member } = await WorkspaceMembershipService.approveJoinRequest(workspace, req.user, requestId);

      emitToRoom({
        room: `workspace:${workspace._id}`,
        event: "member-joined",
        data: { workspaceId: workspace._id, member },
        socketId: req.headers["x-socket-id"]
      });

      return res.status(200).json({
        success: true,
        message: "Đã chấp nhận yêu cầu tham gia",
        data: { member }
      });

    } else {
      await WorkspaceMembershipService.rejectJoinRequest(workspace, req.user, requestId);

      return res.status(200).json({
        success: true,
        message: "Đã từ chối yêu cầu tham gia",
      });
    }
  } catch (error) {
    next(error);
  }
};

// Thêm hàng loạt boards vào workspace
exports.addBoardsToWorkspace = async (req, res, next) => {
  try {
    const { boardIds } = req.body;
    const { workspaceId } = req.params;
    const userId = req.user._id;

    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách boardIds không hợp lệ" });
    }

    // RATE LIMITING: Giới hạn số lượng boards có thể thêm cùng lúc
    const MAX_BOARDS_PER_REQUEST = 10;
    if (boardIds.length > MAX_BOARDS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        message: `Chỉ có thể thêm tối đa ${MAX_BOARDS_PER_REQUEST} board cùng lúc`
      });
    }

    // 1. Kiểm tra quyền Admin/Owner trên các board này TRƯỚC khi cập nhật
    const boards = await Board.find({
      _id: { $in: boardIds },
      deleted_at: null
    });

    if (boards.length !== boardIds.length) {
      return res.status(404).json({ success: false, message: "Một số board không tồn tại hoặc đã bị xóa" });
    }

    // Kiểm tra xem user có phải là owner hoặc admin của TẤT CẢ các board này không
    const hasPermissionAll = boards.every(board => {
      const isOwner = board.owner.equals(userId);
      const isAdmin = board.members.some(m => m.user.equals(userId) && m.role === "admin");
      return isOwner || isAdmin;
    });

    if (!hasPermissionAll) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền quản trị trên một hoặc nhiều board đã chọn"
      });
    }

    // 2. Migrate board members to workspace với transaction
    const migrationResult = await withTransaction(async (session) => {
      const workspace = await Workspace.findById(workspaceId).session(session);

      // Collect all unique member IDs from boards
      const existingMemberIds = new Set(workspace.members.map(m => m.user.toString()));
      const newMembers = [];

      for (const board of boards) {
        for (const boardMember of board.members) {
          const memberIdStr = boardMember.user.toString();

          if (!existingMemberIds.has(memberIdStr)) {
            newMembers.push({
              user: boardMember.user,
              role: 'member',
              joinedAt: new Date()
            });
            existingMemberIds.add(memberIdStr); // Prevent duplicates within this batch
          }
        }
      }

      if (newMembers.length > 0) {
        workspace.members.push(...newMembers);
        await workspace.save({ session });
      }

      // 3. Cập nhật workspace và chuyển visibility sang 'workspace'
      await Board.updateMany(
        { _id: { $in: boardIds } },
        {
          $set: {
            workspace: workspaceId,
            visibility: "workspace"
          }
        },
        { session }
      );

      return { membersAdded: newMembers.length, workspace };
    });

    console.log(`[addBoardsToWorkspace] Auto-added ${migrationResult.membersAdded} members to workspace`);

    // 4. Fetch các board đã cập nhật để trả về cho FE
    const updatedBoards = await Board.find({
      _id: { $in: boardIds },
      deleted_at: null
    })
      .populate("owner", "email full_name avatar.url")
      .populate("members.user", "email full_name avatar.url");

    // Socket emit
    emitToRoom({
      room: `workspace:${workspaceId}`,
      event: "boards-added",
      data: { workspaceId, boards: updatedBoards },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity for each board moved
    for (const board of boards) {
      logBoardMovedToWorkspace(board, migrationResult.workspace, userId);
    }

    res.status(200).json({
      success: true,
      message: `Đã thêm ${boardIds.length} board vào workspace thành công`,
      data: { boards: updatedBoards }
    });
  } catch (error) {
    next(error);
  }
};

// Loại bỏ hàng loạt boards khỏi workspace
exports.removeBoardsFromWorkspace = async (req, res, next) => {
  try {
    const { boardIds } = req.body;
    const { workspaceId } = req.params;

    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách boardIds không hợp lệ" });
    }

    // Workspace Owner/Admin có quyền tối cao, có thể loại bỏ bất kỳ board nào trong workspace
    // Fetch boards before update for logging
    const boards = await Board.find({
      _id: { $in: boardIds },
      workspace: workspaceId,
      deleted_at: null
    });

    const result = await Board.updateMany(
      {
        _id: { $in: boardIds },
        workspace: workspaceId,
        deleted_at: null
      },
      {
        $set: {
          workspace: null,
          visibility: "private"
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy board nào trong workspace này" });
    }

    // Log activity for each board removed
    const workspace = await Workspace.findById(workspaceId);
    for (const board of boards) {
      logBoardRemovedFromWorkspace(board, workspace, req.user._id);
    }

    // Socket emit
    emitToRoom({
      room: `workspace:${workspaceId}`,
      event: "boards-removed",
      data: { workspaceId, boardIds },
      socketId: req.headers["x-socket-id"],
    });

    res.status(200).json({
      success: true,
      message: `Đã loại bỏ ${result.modifiedCount} board khỏi workspace thành công`,
    });
  } catch (error) {
    next(error);
  }
};
