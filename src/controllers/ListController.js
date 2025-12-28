const List = require("../models/List.model");
const { listSchema } = require("../utils/validationSchemas");

// Tạo list mới
module.exports.create = async (req, res, next) => {
  try {
    const { title, color } = listSchema.parse(req.body);
    const boardId = req.params.boardId;

    // Lấy order lớn nhất hiện tại trong board + 1
    const lastList = await List.findOne({ board: boardId }).sort({ order: -1 });
    const newOrder = lastList ? lastList.order + 1 : 0;

    const newList = await List.create({
      title,
      color: color || "gray",
      board: boardId,
      order: newOrder,
    });

    res.status(201).json({
      success: true,
      message: "Tạo list thành công",
      data: { list: newList },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả list nằm trong board
module.exports.getBoardLists = async (req, res, next) => {
  try {
    const lists = await List.find({ board: req.params.boardId }).sort({
      order: 1,
    });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách list thành công",
      data: { lists },
    });
    0;
  } catch (error) {
    next(error);
  }
};

// Update list
module.exports.updateList = async (req, res, next) => {
  try {
    const validatedData = listSchema.parse(req.body);

    const updatedList = await List.findByIdAndUpdate(
      req.params.listId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    if (!updatedList) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật list thành công",
      data: { list: updatedList },
    });
  } catch (error) {
    next(error);
  }
};

// Xóa list
module.exports.deleteList = async (req, res, next) => {
  try {
    const deletedList = await List.findByIdAndDelete(req.params.listId);

    if (!deletedList) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: "Xóa list thành công",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
