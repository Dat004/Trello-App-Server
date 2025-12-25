const Workspace = require("../models/Workspace.model");

// Middleware check user là member của workspace (owner + admin + member)
const requireWorkspaceMember = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      const err = new Error("Workspace không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      const err = new Error("Bạn không phải thành viên của workspace này");
      err.statusCode = 403;
      return next(err);
    }

    // Gán để controller dùng
    req.workspace = workspace;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware check user là admin hoặc owner
const requireWorkspaceAdmin = async (req, res, next) => {
  try {
    await requireWorkspaceMember(req, res, () => {});

    if (!req.workspace) {
      const err = new Error("Bạn không phải thành viên của workspace này");
      err.statusCode = 403;
      return next(err);
    }

    const isOwner = req.workspace.owner.toString() === req.user._id.toString();
    const isAdmin = req.workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.role === "admin"
    );

    if (!isOwner && !isAdmin) {
      const err = new Error("Bạn cần quyền admin để thực hiện hành động này");
      err.statusCode = 403;
      return next(err);
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireWorkspaceMember, requireWorkspaceAdmin };
