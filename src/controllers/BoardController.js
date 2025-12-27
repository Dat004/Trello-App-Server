const Board = require("../models/Board.model");
const {
  boardSchema,
  updateBoardsSchema,
} = require("../utils/validationSchemas");

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
    };

    if (workspaceId) {
      boardData.workspace = workspaceId;
      // Check quyền tạo board trong workspace (dùng permissions của workspace)
      const workspace = req.workspace; // từ middleware requireWorkspaceMember
      const allowedCreate =
        workspace.permissions.canCreateBoard === "admin_member"
          ? ["admin", "member"]
          : ["admin"];
      if (!allowedCreate.includes(req.userRoleInWorkspace)) {
        const err = new Error(
          "Bạn không có quyền tạo board trong workspace này"
        );
        err.statusCode = 403;
        return next(err);
      }
    }

    const newBoard = await Board.create(boardData);

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
      archived: false,
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

// Chi tiết board
module.exports.getBoardById = async (req, res, next) => {
  try {
    const board = req.board;

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

    const updatedBoard = await Board.findByIdAndUpdate(
      req.params.boardId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    if (!updatedBoard) {
      return res.status(404).json({
        success: false,
        message: "Board không tồn tại",
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
    await Board.findByIdAndDelete(req.params.boardId);

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
      const err = new Error('Board đã được lưu trữ');
      err.statusCode = 400;
      return next(err);
    }

    const updatedBoard = await Board.findByIdAndUpdate(
      req.params.boardId,
      { archived: true },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Board đã được lưu trữ thành công',
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
      const err = new Error('Board chưa được lưu trữ');
      err.statusCode = 400;
      return next(err);
    }

    const updatedBoard = await Board.findByIdAndUpdate(
      req.params.boardId,
      { archived: false },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Board đã được khôi phục thành công',
      data: { board: updatedBoard },
    });
  } catch (error) {
    next(error);
  }
};
