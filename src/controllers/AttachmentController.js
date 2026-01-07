const Attachment = require("../models/Attachment.model");

const { attachmentInputSchema } = require("../utils/validationSchemas");

module.exports.addAttachment = async (req, res, next) => {
  try {
    const validatedData = attachmentInputSchema.parse(req.body);
    const card = req.card;
    const workspaceId = req.board.workspace;

    const attachmentData = {
      ...validatedData,
      card: card._id,
      board: card.board,
      workspace: workspaceId,
      uploaded_by: req.user._id,
    };
    const newAttachment = await Attachment.create(attachmentData);

    await newAttachment.populate("uploaded_by", "full_name avatar");
    res.status(201).json({
      success: true,
      message: "Thêm attachment thành công",
      data: { attachment: newAttachment },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getAttachmentsByCard = async (req, res, next) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    const attachments = await Attachment.find({ card: req.params.cardId })
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("uploaded_by", "full_name avatar");

    const total = await Attachment.countDocuments({ card: req.params.cardId });
    const hasMore = parseInt(skip) + attachments.length < total;

    res.status(200).json({
      success: true,
      message: "Lấy attachments thành công",
      data: {
        attachments,
        hasMore,
        nextSkip: parseInt(skip) + attachments.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.destroyAttachment = async (req, res, next) => {
  try {
    await Attachment.findByIdAndDelete(req.params.attachmentId);

    res.status(200).json({
      success: true,
      message: "Xóa attachment thành công",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
