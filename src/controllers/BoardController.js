const Board = require("../models/Board.model");
const { boardSchema } = require("../utils/validationSchemas");

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
        const err = new Error("Bạn không có quyền tạo board trong workspace này");
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
