const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");

// Middleware check quyền truy cập board
const requireBoardAccess = async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.boardId);

    if (!board) {
      const err = new Error("Board không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    const isOwner = board.owner.toString() === req.user._id.toString();
    const isBoardMember = board.members.some(
      (m) => m.user.toString() === req.user._id.toString()
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
      const workspace = await Workspace.findById(board.workspace);
      const isWorkspaceMember = workspace.members.some(
        (m) => m.user.toString() === req.user._id.toString()
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

module.exports = requireBoardAccess;
