const mongoose = require("mongoose");

const BoardMembershipService = require("../services/membership/board.service");
const { deleteBoard } = require("../services/board/delete");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const User = require("../models/User.model");
const {
  boardSchema,
  inviteMemberSchema,
  updateBoardsSchema,
} = require("../utils/validationSchemas");
const { emitToRoom } = require("../utils/socketHelper");
const {
  logBoardCreated,
  logBoardUpdated,
  logBoardDeleted,
  logBoardArchived,
  logBoardRestored,
  logMemberRemoved,
  logMemberAdded,
} = require("../services/activity/log");

module.exports.create = async (req, res, next) => {
  try {
    const { title, description, color, visibility, workspaceId } =
      boardSchema.parse(req.body);
    const boardData = {
      title,
      description: description || "",
      color: color || "bg-blue-500",
      visibility: workspaceId ? "workspace" : (visibility || "private"),
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    };

    if (workspaceId) {
      boardData.workspace = workspaceId;

      // Fetch workspace vì route này không có middleware requireWorkspaceMember
      const workspace = await Workspace.findOne({
        _id: workspaceId,
        deleted_at: null,
      });

      if (!workspace) {
        const err = new Error("Workspace không tồn tại");
        err.statusCode = 404;
        return next(err);
      }

      // Xác định role của user trong workspace
      const isOwner = workspace.owner.equals(req.user._id);
      const member = workspace.members.find(m => m.user.equals(req.user._id));

      if (!isOwner && !member) {
        const err = new Error("Bạn không phải thành viên của workspace này");
        err.statusCode = 403;
        return next(err);
      }

      const userRoleInWorkspace = isOwner ? "admin" : member.role;

      // Check quyền tạo board dựa trên settings của workspace
      const allowedCreate =
        workspace.permissions.canCreateBoard === "admin_member"
          ? ["admin", "member"]
          : ["admin"];

      if (!allowedCreate.includes(userRoleInWorkspace)) {
        const err = new Error(
          "Bạn không có quyền tạo board trong workspace này"
        );
        err.statusCode = 403;
        return next(err);
      }
    }

    const newBoard = await Board.create(boardData);

    // Log activity
    logBoardCreated(newBoard, req.user._id);

    // Socket emit - if board belongs to workspace, notify workspace
    if (newBoard.workspace) {
      emitToRoom({
        room: `workspace:${newBoard.workspace}`,
        event: "board-created", // or workspace-updated if simple refresh needed
        data: newBoard,
        socketId: req.headers["x-socket-id"],
      });
    }

    res.status(201).json({
      success: true,
      message: "Tạo board thành công",
      data: { board: newBoard },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.getMyBoards = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Lấy tất cả workspace mà user là member hoặc owner
    const userWorkspaces = await Workspace.find({
      $or: [
        { owner: userId },
        { "members.user": userId }
      ],
      deleted_at: null
    }).select('_id');

    const workspaceIds = userWorkspaces.map(ws => ws._id);

    // 2. Query boards với workspace membership check
    const boards = await Board.find({
      $or: [
        // Board user là owner
        { owner: userId },

        // Personal board (không có workspace) mà user là member
        { workspace: null, "members.user": userId },

        // Workspace board mà user là board member
        {
          workspace: { $exists: true, $ne: null },
          "members.user": userId
        },

        // Workspace board với visibility="workspace" VÀ user là workspace member
        {
          workspace: { $in: workspaceIds },
          visibility: "workspace"
        }
      ],
      deleted_at: null,
    }).sort({ updated_at: -1 });

    await Board.populate(boards,
      {
        path: "members.user",
        select: "_id full_name avatar.url email",
      }
    );
    await Board.populate(boards,
      {
        path: "join_requests.user",
        select: "_id full_name avatar.url email",
      }
    );

    res.status(200).json({
      success: true,
      message: "Lấy danh sách board thành công",
      data: { boards },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả boards trong một workspace cụ thể
module.exports.getBoardsByWorkspace = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    // Validate workspaceId
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      const error = new Error("Workspace ID không hợp lệ");
      error.statusCode = 400;
      return next(error);
    }

    // Lấy tất cả boards thuộc workspace này
    const boards = await Board.find({
      workspace: workspaceId,
      deleted_at: null,
    })
      .populate("owner", "email full_name avatar.url")
      .populate("members.user", "email full_name avatar.url")
      .sort({ updated_at: -1 });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách board trong workspace thành công",
      data: { boards },
    });
  } catch (error) {
    next(error);
  }
};

// Chi tiết board
module.exports.getBoardById = async (req, res, next) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      const error = new Error("Board ID không hợp lệ");
      error.statusCode = 400;
      return next(error);
    }

    // Lấy board và populate thông tin
    const board = await Board.findOne({
      _id: boardId,
      deleted_at: null,
    })
      .populate("members.user", "_id full_name avatar.url email")
      .populate("join_requests.user", "_id full_name avatar.url email");

    if (!board) {
      const error = new Error("Board không tồn tại");
      error.statusCode = 404;
      return next(error);
    }

    // Kiểm tra membership status của user hiện tại
    const isOwner = board.owner.equals(req.user._id);
    const isBoardMember = board.members.some((m) =>
      m.user && m.user._id.equals(req.user._id)
    );

    // Check workspace membership if board belongs to workspace
    let isWorkspaceMember = false;
    if (board.workspace && board.visibility === "workspace") {
      const workspace = await Workspace.findById(board.workspace);
      if (workspace) {
        isWorkspaceMember = workspace.members.some((m) =>
          m.user.equals(req.user._id)
        ) || workspace.owner.equals(req.user._id);
      }
    }

    const hasAccess = isOwner || isBoardMember || isWorkspaceMember || board.visibility === 'public';

    // Nếu user không có quyền truy cập, chỉ trả về thông tin cơ bản
    if (!hasAccess) {
      const pendingRequest = board.join_requests.find(
        (jr) => jr.user && jr.user._id.equals(req.user._id) && jr.status === "pending"
      );

      return res.status(200).json({
        success: true,
        message: "Lấy thông tin board thành công",
        data: {
          board: {
            _id: board._id,
            title: board.title,
            description: board.description,
            visibility: board.visibility,
            workspace: board.workspace, // Thêm workspace info
            owner: {
              _id: board.owner._id,
              full_name: board.owner.full_name,
              avatar: board.owner.avatar
            }
          },
          is_member: false,
          has_pending_request: !!pendingRequest,
          requested_at: pendingRequest ? pendingRequest.requested_at : null,
          redirect_workspace_id: (board.visibility === 'workspace' && board.workspace) ? board.workspace : null, // Redirect logic
        },
      });
    }

    // User có quyền truy cập, load full data với lists và cards
    const boards = await Board.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(boardId),
          deleted_at: null,
        },
      },
      // Lookup lists
      {
        $lookup: {
          from: "lists",
          let: { boardId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$board", "$$boardId"] },
                deleted_at: null,
              },
            },
            { $sort: { pos: 1 } },
          ],
          as: "lists",
        },
      },
      // Lookup cards
      {
        $lookup: {
          from: "cards",
          let: { boardId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$board", "$$boardId"] },
                deleted_at: null,
              },
            },
            { $sort: { pos: 1 } },

            {
              $lookup: {
                from: "comments",
                let: { cardId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$card", "$$cardId"] },
                      deleted_at: null,
                    },
                  },
                  { $count: "count" },
                ],
                as: "comments_count_data",
              },
            },

            {
              $lookup: {
                from: "attachments",
                let: { cardId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$card", "$$cardId"] },
                      deleted_at: null,
                    },
                  },
                  { $count: "count" },
                ],
                as: "attachments_count_data",
              },
            },

            {
              $lookup: {
                from: "users",
                localField: "members",
                foreignField: "_id",
                as: "members"
              }
            },

            {
              $addFields: {
                comment_count: {
                  $ifNull: [
                    { $arrayElemAt: ["$comments_count_data.count", 0] },
                    0,
                  ],
                },
                attachment_count: {
                  $ifNull: [
                    { $arrayElemAt: ["$attachments_count_data.count", 0] },
                    0,
                  ],
                },
                members: {
                  $map: {
                    input: "$members",
                    as: "member",
                    in: {
                      _id: "$$member._id",
                      full_name: "$$member.full_name",
                      email: "$$member.email",
                      avatar: "$$member.avatar"
                    }
                  }
                }
              },
            },

            {
              $project: {
                comments_count_data: 0,
                attachments_count_data: 0,
              },
            },
          ],
          as: "cards",
        },
      },
      // Xử lý dữ liệu
      {
        $addFields: {
          lists: {
            $map: {
              input: "$lists",
              as: "list",
              in: {
                $mergeObjects: [
                  "$$list",
                  {
                    cards: {
                      $filter: {
                        input: "$cards",
                        as: "card",
                        cond: { $eq: ["$$card.list", "$$list._id"] },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $unset: "cards",
      },
    ]);

    const fullBoard = boards[0];

    if (!fullBoard) {
      return res.status(404).json({
        success: false,
        message: "Board không tồn tại hoặc đã bị xóa",
      });
    }

    await Board.populate(fullBoard, [
      {
        path: "members.user",
        select: "_id email full_name avatar.url",
      },
      {
        path: "join_requests.user",
        select: "_id full_name email avatar.url",
      },
    ]);

    // isMember chỉ tính Board Member hoặc Owner (người có quyền Edit)
    const isMember = isOwner || isBoardMember;

    // Read-only nếu không phải là member thực sự của board
    // (Workspace member vẫn xem được nhưng read-only cho đến khi join)

    res.status(200).json({
      success: true,
      message: "Lấy chi tiết board thành công",
      data: {
        board: fullBoard,
        is_member: isMember,
        read_only: !isMember
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật boards
module.exports.updateBoard = async (req, res, next) => {
  try {
    const validatedData = updateBoardsSchema.parse(req.body);

    // Lấy board cũ để track changes
    const oldBoard = await Board.findOne({
      _id: req.params.boardId,
      deleted_at: null,
    });

    const updatedBoard = await Board.findOneAndUpdate(
      {
        _id: req.params.boardId,
        deleted_at: null,
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    if (!updatedBoard) {
      return res.status(404).json({
        success: false,
        message: "Board không tồn tại",
      });
    }

    // Log activity with changes
    const changes = {};
    if (validatedData.title && oldBoard.title !== validatedData.title) {
      changes.title = { from: oldBoard.title, to: validatedData.title };
    }
    if (validatedData.description !== undefined && oldBoard.description !== validatedData.description) {
      changes.description = { from: oldBoard.description, to: validatedData.description };
    }
    if (validatedData.color && oldBoard.color !== validatedData.color) {
      changes.color = { from: oldBoard.color, to: validatedData.color };
    }
    if (validatedData.visibility && oldBoard.visibility !== validatedData.visibility) {
      changes.visibility = { from: oldBoard.visibility, to: validatedData.visibility };
    }
    if (Object.keys(changes).length > 0) {
      logBoardUpdated(updatedBoard, req.user._id, changes);
    }

    // Socket emit
    emitToRoom({
      room: `board:${updatedBoard._id}`,
      event: "board-updated",
      data: updatedBoard,
      socketId: req.headers["x-socket-id"],
    });

    // Nếu board thuộc workspace và thay đổi title hoặc visibility
    if (updatedBoard.workspace && (changes.title || changes.visibility)) {
      emitToRoom({
        room: `workspace:${updatedBoard.workspace}`,
        event: "board-updated-in-workspace",
        data: updatedBoard,
        socketId: req.headers["x-socket-id"],
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật board thành công",
      data: { board: updatedBoard },
    });
  } catch (error) {
    next(error);
  }
};

// Xóa board
module.exports.destroy = async (req, res, next) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      deleted_at: null,
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        message: "Board không tồn tại",
      });
    }

    // Log activity
    logBoardDeleted(board, req.user._id);

    // Socket emit - notify board members (redirect or show alert)
    emitToRoom({
      room: `board:${req.params.boardId}`,
      event: "board-deleted",
      data: req.params.boardId,
      socketId: req.headers["x-socket-id"],
    });

    // Notify workspace if applicable
    if (board.workspace) {
      console.log(`workspace:${board.workspace}`);
      emitToRoom({
        room: `workspace:${board.workspace}`,
        event: "board-deleted",
        data: req.params.boardId,
        socketId: req.headers["x-socket-id"],
      });
    }

    await deleteBoard(req.params.boardId, { actor: req.user._id });

    res.status(200).json({
      success: true,
      message: "Xóa board thành công",
    });
  } catch (err) {
    next(err);
  }
};

// Archive board (ẩn khỏi list)
exports.archiveBoard = async (req, res, next) => {
  try {
    const board = req.board;

    if (board.archived) {
      const err = new Error("Board đã được lưu trữ");
      err.statusCode = 400;
      return next(err);
    }

    const updatedBoard = await Board.findOneAndUpdate(
      { _id: req.params.boardId, deleted_at: null },
      { archived: true },
      { new: true }
    );

    // Log activity
    logBoardArchived(updatedBoard, req.user._id);

    res.status(200).json({
      success: true,
      message: "Board đã được lưu trữ thành công",
      data: { board: updatedBoard },
    });
  } catch (error) {
    next(error);
  }
};

// Unarchive board (khôi phục)
exports.unarchiveBoard = async (req, res, next) => {
  try {
    const board = req.board;

    if (!board.archived) {
      const err = new Error("Board chưa được lưu trữ");
      err.statusCode = 400;
      return next(err);
    }

    const updatedBoard = await Board.findOneAndUpdate(
      { _id: req.params.boardId, deleted_at: null },
      { archived: false },
      { new: true }
    );

    // Log activity
    logBoardRestored(updatedBoard, req.user._id);

    res.status(200).json({
      success: true,
      message: "Board đã được khôi phục thành công",
      data: { board: updatedBoard },
    });
  } catch (error) {
    next(error);
  }
};

// Invite member vào board
module.exports.inviteMemberToBoard = async (req, res, next) => {
  try {
    const { email, role } = inviteMemberSchema.parse(req.body);
    const board = req.board;

    const { board: updatedBoard } = await BoardMembershipService.inviteMember(
      board,
      req.user,
      email,
      role
    );

    res.status(200).json({
      success: true,
      message: "Mời thành viên vào board thành công",
      data: { board: updatedBoard },
    });
  } catch (error) {
    next(error);
  }
};

// Kick member khỏi board
module.exports.kickMemberFromBoard = async (req, res, next) => {
  try {
    const { member_id } = req.body;
    const board = req.board;

    await BoardMembershipService.kickMember(
      board,
      req.user,
      member_id
    );

    res.status(200).json({
      success: true,
      message: "Kick thành viên khỏi board thành công",
    });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/boards/:boardId/join-requests/:requestId/respond
module.exports.handleJoinRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' hoặc 'declined'

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const board = req.board;

    if (status === "accepted") {
      const { member } = await BoardMembershipService.approveJoinRequest(board, req.user, requestId);

      return res.status(200).json({
        success: true,
        message: "Đã chấp nhận yêu cầu tham gia",
        data: { member }
      });

    } else {
      await BoardMembershipService.rejectJoinRequest(board, req.user, requestId);

      return res.status(200).json({
        success: true,
        message: "Đã từ chối yêu cầu tham gia",
      });
    }
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/boards/:boardId/members/role
module.exports.updateMemberRole = async (req, res, next) => {
  try {
    const { member_id, role } = req.body;

    if (!["admin", "member", "viewer"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role không hợp lệ" });
    }

    const board = req.board;

    const result = await BoardMembershipService.updateMemberRole(
      board,
      req.user,
      member_id,
      role
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật role thành công",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/boards/:boardId/join
module.exports.sendJoinRequest = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { message } = req.body;

    const board = await Board.findOne({ _id: boardId, deleted_at: null });

    if (!board) {
      return res.status(404).json({ success: false, message: "Board không tồn tại" });
    }

    // Check if already a member
    const isAlreadyMember = board.members.some(m => m.user.equals(req.user._id)) ||
      board.owner.equals(req.user._id);
    if (isAlreadyMember) {
      return res.status(400).json({ success: false, message: "Bạn đã là thành viên của board này" });
    }

    // Check if already has pending request
    const existingRequest = board.join_requests.find(
      jr => jr.user.equals(req.user._id) && jr.status === "pending"
    );
    if (existingRequest) {
      return res.status(400).json({ success: false, message: "Bạn đã gửi yêu cầu tham gia trước đó" });
    }

    board.join_requests.push({
      user: req.user._id,
      message: message || "",
      requested_at: new Date(),
      status: "pending"
    });

    await board.save();

    // Populate user info for socket event
    await board.populate({
      path: "join_requests.user",
      select: "_id full_name email avatar.url"
    });

    const newRequest = board.join_requests[board.join_requests.length - 1];

    // Emit socket event to board admins
    emitToRoom({
      room: `board:${board._id}`,
      event: "join-request-received",
      data: newRequest,
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

// [GET] /api/boards/:boardId/join
module.exports.getJoinRequests = async (req, res, next) => {
  try {
    const board = req.board;

    await board.populate({
      path: "join_requests.user",
      select: "_id full_name email avatar.url"
    });

    const pendingRequests = board.join_requests.filter(jr => jr.status === "pending");

    res.status(200).json({
      success: true,
      message: "Lấy danh sách yêu cầu tham gia thành công",
      data: { requests: pendingRequests }
    });
  } catch (error) {
    next(error);
  }
};
