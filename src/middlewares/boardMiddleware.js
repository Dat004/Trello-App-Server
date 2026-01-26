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

    // Quyền truy cập ngầm định thông qua Workspace
    let isWorkspaceAdminOrOwner = false;
    if (board.workspace) {
      const workspace = await Workspace.findOne({
        _id: board.workspace,
        deleted_at: null,
      });

      if (workspace) {
        const isOwnerWorkspace = workspace.owner.equals(userId);
        const isAdminWorkspace = workspace.members.some(
          (m) => m.user.equals(userId) && m.role === "admin"
        );
        isWorkspaceAdminOrOwner = isOwnerWorkspace || isAdminWorkspace;

        // Nếu là member của workspace và board có tính ẩn 'workspace'
        if (board.visibility === "workspace") {
          const isWorkspaceMember = workspace.members.some((m) =>
            m.user.equals(userId)
          );
          if (isWorkspaceMember) {
            req.board = board;
            return next();
          }
        }
      }
    }

    // Kiểm tra quyền truy cập trực tiếp
    if (isOwner || isBoardMember || isWorkspaceAdminOrOwner) {
      req.board = board;
      return next();
    }

    // Nếu không thuộc các trường hợp trên
    const err = new Error("Bạn không có quyền truy cập board này");
    err.statusCode = 403;
    return next(err);
  } catch (error) {
    next(error);
  }
};

// Middleware check user là owner hoặc admin của board (bao gồm cả Workspace Admin/Owner)
const requireBoardAdmin = async (req, res, next) => {
  try {
    const board = req.board; // từ requireBoardAccess
    const userId = req.user._id;

    const isOwner = board.owner.equals(userId);
    const isAdmin = board.members.some(
      (m) => m.user.equals(userId) && m.role === "admin"
    );

    // Kiểm tra quyền Admin ngầm định từ Workspace
    let isWorkspaceAdminOrOwner = false;
    if (board.workspace) {
      const workspace = await Workspace.findOne({
        _id: board.workspace,
        deleted_at: null,
      });
      if (workspace) {
        const isOwnerWorkspace = workspace.owner.equals(userId);
        const isAdminWorkspace = workspace.members.some(
          (m) => m.user.equals(userId) && m.role === "admin"
        );
        isWorkspaceAdminOrOwner = isOwnerWorkspace || isAdminWorkspace;
      }
    }

    if (!isOwner && !isAdmin && !isWorkspaceAdminOrOwner) {
      const err = new Error("Bạn cần quyền admin để thực hiện hành động này");
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
