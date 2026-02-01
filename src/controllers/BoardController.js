const mongoose = require("mongoose");

const { deleteBoard } = require("../services/board/delete");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const User = require("../models/User.model");
const {
  boardSchema,
  inviteMemberSchema,
  updateBoardsSchema,
} = require("../utils/validationSchemas");
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
      visibility: visibility || (workspaceId ? "workspace" : "private"),
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
    const boards = await Board.find({
      $or: [
        { owner: userId },
        { workspace: null, "members.user": userId }, // personal board được invite
        {
          workspace: { $exists: true },
          $or: [
            // workspace board
            { visibility: "workspace" }, // tất cả member workspace thấy
            { "members.user": userId }, // hoặc được invite riêng
          ],
        },
      ],
      deleted_at: null,
    }).sort({ updated_at: -1 });

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
                deleted_at: null, // Lọc soft delete
              },
            },
            { $sort: { pos: 1 } }, // Sắp xếp theo pos tăng dần
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
                    // Lọc mảng cards lớn để lấy cards thuộc về list này
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
      // Xóa trường cards
      {
        $unset: "cards",
      },
    ]);

    // 2. Lấy phần tử đầu tiên của mảng kết quả
    const board = boards[0];

    if (!board) {
      return res.status(404).json({
        success: false,
        message: "Board không tồn tại hoặc đã bị xóa",
      });
    }

    await Board.populate(board, {
      path: "members.user",
      select: "_id email full_name avatar.url",
    });

    res.status(200).json({
      success: true,
      message: "Lấy chi tiết board thành công",
      data: { board },
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
    const board = req.board;

    await deleteBoard(req.params.boardId, { actor: req.user._id });

    // Log activity
    logBoardDeleted(board, req.user._id);

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

    // Kiểm tra email đã tồn tại trong hệ thống
    const invitedUser = await User.findOne({ email: email });
    if (!invitedUser) {
      const err = new Error(
        "Email này chưa được đăng ký tài khoản. Không thể mời."
      );
      err.statusCode = 400;
      return next(err);
    }

    // Check trùng trong board.members
    const existingMember = board.members.find(
      (m) => m.user.toString() === invitedUser._id.toString()
    );
    if (existingMember) {
      const err = new Error("Người dùng này đã là thành viên board");
      err.statusCode = 400;
      return next(err);
    }

    board.members.push({
      user: invitedUser._id,
      role,
    });

    await board.save();

    // // Log activity
    // logMemberAdded({
    //   entityType: 'board',
    //   entityId: board._id,
    //   workspace: board.workspace || null,
    //   board: board._id,
    //   member: invitedUser,
    //   role,
    //   actor: req.user._id
    // });

    res.status(200).json({
      success: true,
      message: "Mời thành viên vào board thành công",
      data: { board },
    });
  } catch (error) {
    next(error);
  }
};

// Kick member khỏi board
module.exports.kickMemberFromBoard = async (req, res, next) => {
  try {
    const { memberUserId } = req.body;
    const board = req.board;

    // Không cho kick owner
    if (board.owner.toString() === memberUserId) {
      const err = new Error("Không thể kick owner khỏi board");
      err.statusCode = 400;
      return next(err);
    }

    const memberIndex = board.members.findIndex(
      (m) => m.user.toString() === memberUserId
    );
    if (memberIndex === -1) {
      const err = new Error("Thành viên không tồn tại trong board");
      err.statusCode = 404;
      return next(err);
    }

    board.members.splice(memberIndex, 1);
    await board.save();

    // Log activity
    const member = await User.findById(memberUserId);
    logMemberRemoved({
      entityType: 'board',
      entityId: board._id,
      workspace: board.workspace || null,
      board: board._id,
      member,
      actor: req.user._id
    });

    res.status(200).json({
      success: true,
      message: "Kick thành viên khỏi board thành công",
      data: { board },
    });
  } catch (error) {
    next(error);
  }
};
