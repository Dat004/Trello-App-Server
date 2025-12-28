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

// Update order lists
module.exports.updateListsOrder = async (req, res, next) => {
  try {
    const { lists } = req.body;
    const boardId = req.params.boardId;

    if (!Array.isArray(lists) || lists.length === 0) {
      const err = new Error("Dữ liệu lists không hợp lệ");
      err.statusCode = 400;
      return next(err);
    }

    // Lấy tất cả list hiện tại của board để validate
    const currentLists = await List.find({ board: boardId });
    const currentListIds = currentLists.map((l) => l._id.toString());

    // Validate: array gửi lên phải có đúng số lượng và id list của board
    if (lists.length !== currentLists.length) {
      const err = new Error("Số lượng list không khớp");
      err.statusCode = 400;
      return next(err);
    }

    const sentListIds = lists.map((l) => l.id);
    const hasDuplicateId = new Set(sentListIds).size !== sentListIds.length;
    const hasInvalidId = sentListIds.some((id) => !currentListIds.includes(id));

    if (hasDuplicateId || hasInvalidId) {
      const err = new Error("Danh sách list ID không hợp lệ hoặc trùng lặp");
      err.statusCode = 400;
      return next(err);
    }

    // Validate order: 0 đến length-1, không duplicate
    const orders = lists.map((l) => l.order);
    const orderSet = new Set(orders);
    if (
      orderSet.size !== orders.length ||
      Math.min(...orders) !== 0 ||
      Math.max(...orders) !== orders.length - 1
    ) {
      const err = new Error(
        "Order không hợp lệ (phải từ 0 đến n-1, không trùng)"
      );
      err.statusCode = 400;
      return next(err);
    }

    // Bulk update order
    const updatePromises = lists.map(({ id, order }) => {
      return List.findByIdAndUpdate(id, { $set: order }, { new: true });
    });

    const updatedLists = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Cập nhật thứ tự list thành công",
      data: { lists: updatedLists.sort((a, b) => a.order - b.order) },
    });
  } catch (error) {
    next(error);
  }
};
