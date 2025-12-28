const Card = require("../models/Card.model");
const List = require("../models/List.model");

const { createCardSchema } = require("../utils/validationSchemas");

module.exports.getCardsByList = async (req, res, next) => {
  try {
    const cards = Card.find({ list: req.params.listId }).sort({ order: -1 });

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
    const { title, description, due_date, priority, labels } =
      createCardSchema.parse(req.body);
    const listId = req.params.listId;

    const list = await List.findById(listId);
    if (!list) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Tính order mới trong list
    const lastCard = await Card.findOne({ list: listId }).sort({ order: -1 });
    const newOrder = lastCard ? lastCard.order + 1 : 0;

    const newCard = await Card.create({
      title,
      description,
      list: listId,
      board: list.board,
      order: newOrder,
      due_date: due_date || "Chưa có hạn cụ thể",
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
