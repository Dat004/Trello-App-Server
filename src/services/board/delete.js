const withTransaction = require("../common/withTransaction");
const Board = require("../../models/Board.model");
const List = require("../../models/List.model");
const Card = require("../../models/Card.model");
const Comment = require("../../models/Comment.model");
const Attachment = require("../../models/Attachment.model");

module.exports.deleteBoard = async (boardId, { actor }) => {
  return withTransaction(async (session) => {
    // 1. Kiểm tra Board tồn tại và chưa bị xóa
    const board = await Board.findOne({
      _id: boardId,
      deleted_at: null,
    }).session(session);

    if (!board) {
      const error = new Error("Board không tồn tại");
      error.statusCode = 404;
      throw error;
    }

    const deleteMetadata = {
      deleted_at: new Date(),
      deleted_by: actor,
    };

    // 2. Thực hiện Soft Delete song song (Batch Update)
    await Promise.all([
      // Xóa Board
      Board.updateOne({ _id: boardId }, deleteMetadata).session(session),

      // Xóa tất cả Lists thuộc Board
      List.updateMany(
        { board: boardId, deleted_at: null },
        deleteMetadata
      ).session(session),

      // Xóa tất cả Cards thuộc Board
      Card.updateMany(
        { board: boardId, deleted_at: null },
        deleteMetadata
      ).session(session),

      // Xóa tất cả Resource con
      Comment.updateMany(
        { board: boardId, deleted_at: null },
        deleteMetadata
      ).session(session),
      Attachment.updateMany(
        { board: boardId, deleted_at: null },
        deleteMetadata
      ).session(session),
    ]);

    return { success: true };
  });
};
