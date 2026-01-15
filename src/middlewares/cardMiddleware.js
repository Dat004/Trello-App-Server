const Attachment = require("../models/Attachment.model");
const Comment = require("../models/Comment.model");
const Card = require("../models/Card.model");

// Kiểm tra quyền truy cập card
const requireCardAccess = async (req, res, next) => {
  try {
    const cardId = req.params.cardId;
    if (!cardId) {
      const err = new Error("Card ID không hợp lệ");
      err.statusCode = 400;
      return next(err);
    }

    const card = await Card.findOne({
      _id: cardId,
      deleted_at: null,
    });
    if (!card) {
      const err = new Error("Card không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Gán card vào req
    req.card = card;
    next();
  } catch (error) {
    next(error);
  }
};

// Kiểm tra quyền quản lý card (update card, delete card...)
const requireCardManage = async (req, res, next) => {
  try {
    const board = req.board;
    const card = req.card;

    if (!card.board.equals(board._id)) {
      const err = new Error("Không tìm thấy board.");
      err.statusCode = 404;
      return next(err);
    }

    const userId = req.user._id;

    const isBoardOwner = board.owner.equals(userId);
    const isBoardAdmin = board.members.some(
      (m) => m.user.equals(userId) && m.role === "admin"
    );
    const isCreator = card.creator.equals(userId);

    if (!isBoardOwner && !isBoardAdmin && !isCreator) {
      const err = new Error(
        "Bạn chỉ có quyền quản lý card do mình tạo hoặc với quyền admin"
      );
      err.statusCode = 403;
      return next(err);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Kiểm tra quyền quản lý content card (comments/attachments)
const requireContentManager = async (req, res, next) => {
  try {
    const { commentId, attachmentId } = req.params;
    const { board, card, user } = req;

    if (!card || !card.board) {
      return res.status(500).json({
        success: false,
        message: "Thiếu card context",
      });
    }

    let item;
    let authorField;

    if (commentId) {
      item = await Comment.findOne({
        _id: commentId,
        card: card._id,
        deleted_at: null,
      });
      authorField = "author";
    } else if (attachmentId) {
      item = await Attachment.findOne({
        _id: attachmentId,
        card: card._id,
        deleted_at: null,
      });
      authorField = "uploaded_by";
    }

    if (!item) {
      const err = new Error("Nội dung không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    const userId = user._id;

    const isBoardOwner = board.owner.equals(userId);
    const isBoardAdmin = board.members.some(
      (m) => m.user.equals(userId) && m.role === "admin"
    );
    const isAuthor = item[authorField] && item[authorField].equals(userId);

    if (!isBoardOwner && !isBoardAdmin && !isAuthor) {
      const err = new Error("Bạn không có quyền quản lý nội dung này");
      err.statusCode = 403;
      return next(err);
    }

    req.deleteItem = item;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireCardAccess,
  requireCardManage,
  requireContentManager,
};
