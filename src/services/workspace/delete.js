const withTransaction = require("../common/withTransaction");
const Workspace = require("../../models/Workspace.model");
const Board = require("../../models/Board.model");
const List = require("../../models/List.model");
const Card = require("../../models/Card.model");
const Comment = require("../../models/Comment.model");
const Attachment = require("../../models/Attachment.model");

module.exports.deleteWorkspace = async (workspaceId, { actor }) => {
  return withTransaction(async (session) => {
    // Kiểm tra Workspace tồn tại
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      deleted_at: null,
    }).session(session);

    if (!workspace) {
      const error = new Error("Workspace không tồn tại");
      error.statusCode = 404;
      throw error;
    };

    const deleteData = {
      deleted_at: new Date(),
      deleted_by: actor
    };

    await Promise.all([
      // Update Workspace
      Workspace.updateOne({ _id: workspaceId }, deleteData).session(session),

      // Update toàn bộ Boards thuộc Workspace
      Board.updateMany(
        { workspace: workspaceId, deleted_at: null },
        deleteData
      ).session(session),

      // Update toàn bộ Lists thuộc Workspace
      List.updateMany(
        { workspace: workspaceId, deleted_at: null },
        deleteData
      ).session(session),

      // Update toàn bộ Cards thuộc Workspace
      Card.updateMany(
        { workspace: workspaceId, deleted_at: null },
        deleteData
      ).session(session),

      // Xóa Comment/Attachment nếu có workspaceId
      Comment.updateMany(
        { workspace: workspaceId, deleted_at: null },
        deleteData
      ).session(session),
      Attachment.updateMany(
        { workspace: workspaceId, deleted_at: null },
        deleteData
      ).session(session),
    ]);

    return { success: true }
  });
};
