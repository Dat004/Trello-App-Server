const Card = require("../models/Card.model");
const List = require("../models/List.model");

const { cardSchema } = require("../utils/validationSchemas");

module.exports.getCardsByList = async (req, res, next) => {
  try {
    const cards = await Card.find({ list: req.params.listId }).sort({ pos: 1 });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách card thành công",
      data: { cards },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const { title, description, due_date, priority, labels } = cardSchema.parse(
      req.body
    );
    const listId = req.params.listId;

    const list = await List.findById(listId);
    if (!list) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Tính pos mới: max pos + 65536
    const lastCard = await Card.findOne({ list: listId }).sort({ pos: -1 });
    const newPos = lastCard ? lastCard.pos + 65536 : 65536;

    const newCard = await Card.create({
      title,
      description,
      list: listId,
      board: list.board,
      pos: newPos,
      due_date: due_date || null,
      priority: priority || "medium",
      labels: labels || [],
      creator: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Tạo card thành công",
      data: { card: newCard },
    });
  } catch (error) {
    next(error);
  }
};

// Update info card
module.exports.updateInfo = async (req, res, next) => {
  try {
    const validatedData = cardSchema.parse(req.body);
    const cardId = req.params.cardId;

    const card = await Card.findByIdAndUpdate(
      cardId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );
    if (!card) {
      const err = new Error("Không tìm thấy card");
      err.statusCode = 404;
      return next(err);
    }

    res.status(201).json({
      success: true,
      message: "Cập nhật thông tin card thành công",
      data: { card },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.destroy = async (req, res, next) => {
  try {
    const cardId = req.params.cardId;

    const card = await Card.findByIdAndDelete(cardId);
    if (!card) {
      const err = new Error("Không tìm thấy card");
      err.statusCode = 404;
      return next(err);
    }

    res.status(201).json({
      success: true,
      message: "Xóa card thành công",
    });
  } catch (err) {
    next(err);
  }
};
