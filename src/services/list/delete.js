const withTransaction = require("../common/withTransaction");
const List = require("../../models/List.model");
const Card = require("../../models/Card.model");
const Comment = require("../../models/Comment.model");
const Attachment = require("../../models/Attachment.model");

module.exports.deleteList = async (listId, { actor }) => {
  return withTransaction(async (session) => {
    // 1. Kiểm tra List
    const list = await List.findOne({
      _id: listId,
      deleted_at: null,
    }).session(session);

    if (!list) {
      const error = new Error("List không tồn tại");
      error.statusCode = 404;
      throw error;
    }

    const deletedData = {
      deleted_at: new Date(),
      deleted_by: actor,
    };

    // 2. Tìm ID của các Card thuộc List này (để xóa resource con)
    const cards = await Card.find({ list: listId, deleted_at: null })
      .select("_id")
      .session(session);

    const cardIds = cards.map((c) => c._id);

    // 3. Chuẩn bị các Promise xóa
    const deletePromises = [
      // Xóa List
      List.updateOne({ _id: listId }, deletedData).session(session),

      // Xóa Cards thuộc List
      Card.updateMany({ list: listId, deleted_at: null }, deletedData).session(
        session
      ),
    ];

    // Nếu có Card, thì mới xóa Comment/Attachment con
    if (cardIds.length > 0) {
      deletePromises.push(
        Comment.updateMany(
          { card: { $in: cardIds }, deleted_at: null },
          deletedData
        ).session(session),
        Attachment.updateMany(
          { card: { $in: cardIds }, deleted_at: null },
          deletedData
        ).session(session)
      );
    }

    // 4. Thực thi tất cả
    await Promise.all(deletePromises);

    return { success: true };
  });
};
