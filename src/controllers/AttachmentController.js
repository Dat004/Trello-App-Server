const cloudinary = require("cloudinary").v2;
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

    const attachments = await Attachment.find({
      card: req.params.cardId,
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("uploaded_by", "full_name avatar");

    const total = await Attachment.countDocuments({
      card: req.params.cardId,
      deleted_at: null,
    });
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
    const attachment = await Attachment.findOne({
      _id: req.params.attachmentId,
      deleted_at: null,
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment không tồn tại",
      });
    }

    // Xóa file trên Cloudinary nếu có public_id
    if (attachment.public_id) {
      await cloudinary.uploader.destroy(attachment.public_id, {
        resource_type: "auto",
      });
    }

    // Hard delete attachment
    await Attachment.findByIdAndDelete(attachment._id);

    res.status(200).json({
      success: true,
      message: "Xóa attachment thành công",
    });
  } catch (error) {
    next(error);
  }
};
