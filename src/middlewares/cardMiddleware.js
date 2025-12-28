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

    const card = await Card.findById(cardId);
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

    if (card.board.toString() !== board._id) {
      const err = new Error(
        "Không tìm thất board."
      );
      err.statusCode = 404;
      return next(err);
    }

    const isBoardOwner = board.owner.toString() === req.user._id.toString();
    const isBoardAdmin = board.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.role === "admin"
    );
    const isCreator = card.creator.toString() === req.user._id.toString();

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

module.exports = {
  requireCardAccess,
  requireCardManage,
};
