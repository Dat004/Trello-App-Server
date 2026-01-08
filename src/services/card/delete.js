const withTransaction = require("../common/withTransaction");
const Card = require("../../models/Card.model");
const Comment = require("../../models/Comment.model");
const Attachment = require("../../models/Attachment.model");

module.exports.deleteCard = async (cardId, { actor }) => {
  return withTransaction(async (session) => {
    // 1. Kiểm tra Card
    const card = await Card.findOne({
      _id: cardId,
      deleted_at: null,
    }).session(session);

    if (!card) {
      const error = new Error("Card không tồn tại");
      error.statusCode = 404;
      throw error;
    }

    const deleteData = {
      deleted_at: new Date(),
      deleted_by: actor,
    };

    // 2. Thực hiện xóa song song
    await Promise.all([
      // Xóa Card
      Card.updateOne({ _id: cardId }, deleteData).session(session),

      // Xóa Comments thuộc Card
      Comment.updateMany(
        { card: cardId, deleted_at: null },
        deleteData
      ).session(session),

      // Xóa Attachments thuộc Card
      Attachment.updateMany(
        { card: cardId, deleted_at: null },
        deleteData
      ).session(session),
    ]);

    return { success: true };
  });
};
