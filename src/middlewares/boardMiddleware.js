const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");

// Middleware check quyền truy cập board
const requireBoardAccess = async (req, res, next) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      deleted_at: null,
    });

    if (!board) {
      const err = new Error("Board không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    const userId = req.user._id;
    const isOwner = board.owner.equals(userId);
    const isBoardMember = board.members.some((m) =>
      m.user.equals(userId)
    );

    // Personal board hoặc private board
    if (!board.workspace || board.visibility === "private") {
      if (!isOwner && !isBoardMember) {
        const err = new Error("Bạn không có quyền truy cập board này");
        err.statusCode = 403;
        return next(err);
      }
    }
    // Workspace board với visibility 'workspace'
    else if (board.visibility === "workspace") {
      const workspace = await Workspace.findOne({
        _id: board.workspace,
        deleted_at: null,
      });
      if (!workspace) {
        const err = new Error("Workspace chứa bảng này không tồn tại");
        err.statusCode = 404;
        return next(err);
      }

      const isWorkspaceMember = workspace.members.some((m) =>
        m.user.equals(userId)
      );

      if (!isOwner && !isBoardMember && !isWorkspaceMember) {
        const err = new Error("Bạn không có quyền truy cập board này");
        err.statusCode = 403;
        return next(err);
      }
    }

    // Gán board vào req
    req.board = board;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware check user là owner hoặc admin của board
const requireBoardAdmin = async (req, res, next) => {
  try {
    const board = req.board; // từ requireBoardAccess
    const userId = req.user._id;

    const isOwner = board.owner.equals(req.user._id);
    const isAdmin = board.members.some(
      (m) => m.user.equals(userId) && m.role === "admin"
    );

    if (!isOwner && !isAdmin) {
      const err = new Error("Bạn cần quyền admin để cập nhật board này");
      err.statusCode = 403;
      return next(err);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware check user là owner của board
const requireOwnerBoard = async (req, res, next) => {
  try {
    const board = req.board;
    const userId = req.user._id;

    const isOwnerBoard = board.owner.equals(userId);

    if (board.workspace) {
      const workspace = await Workspace.findOne({
        _id: board.workspace,
        deleted_at: null,
      }).select("owner members");

      if (!workspace) {
        const err = new Error("Workspace không tồn tại");
        err.statusCode = 404;
        return next(err);
      }

      const isOwnerWorkspace = workspace.owner.equals(userId);
      const isAdminWorkspace = workspace.members.some(
        (m) => m.user.equals(userId) && m.role === "admin"
      );

      if (!isOwnerWorkspace && !isAdminWorkspace && !isOwnerBoard) {
        const err = new Error("Bạn không có quyền thực hiện hành động này");
        err.statusCode = 403;
        return next(err);
      }

      return next();
    }

    // Không có workspace chỉ cho phép owner board
    if (!isOwnerBoard) {
      const err = new Error(
        "Chỉ owner board mới có quyền thực hiện hành động này"
      );
      err.statusCode = 403;
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireBoardAccess,
  requireBoardAdmin,
  requireOwnerBoard,
};
