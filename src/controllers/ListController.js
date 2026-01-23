const { listSchema } = require("../utils/validationSchemas");
const { deleteList } = require("../services/list/delete");
const List = require("../models/List.model");
const { emitToRoom } = require("../utils/socketHelper");

// Tạo list mới
module.exports.create = async (req, res, next) => {
  try {
    const { title, color } = listSchema.parse(req.body);
    const boardId = req.params.boardId;
    const workspaceId = req.board.workspace;

    // max pos + 65536
    const lastList = await List.findOne({
      board: boardId,
      deleted_at: null,
    }).sort({ pos: -1 });
    const newPos = lastList ? lastList.pos + 65536 : 65536;

    const newList = await List.create({
      title,
      color: color || "gray",
      board: boardId,
      pos: newPos,
      workspace: workspaceId,
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
    const lists = await List.find({
      board: req.params.boardId,
      deleted_at: null,
    }).sort({
      pos: 1,
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

    const updatedList = await List.findOneAndUpdate(
      {
        _id: req.params.listId,
        deleted_at: null,
      },
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
    await deleteList(req.params.listId, { actor: req.user._id });

    res.status(200).json({
      success: true,
      message: "Xóa list thành công",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Update pos lists
module.exports.updateListPosition = async (req, res, next) => {
  try {
    const { prevListId, nextListId } = req.body;
    const listId = req.params.listId;
    const boardId = req.params.boardId;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu listId",
      });
    }

    // Lấy list đang drag
    const currentList = await List.findOne({
      _id: listId,
      board: boardId,
      deleted_at: null,
    });

    if (!currentList) {
      return res.status(404).json({
        success: false,
        message: "List không tồn tại trong board",
      });
    }

    let newPos;

    // Case 1: kéo lên đầu (no prev, có next)
    if (!prevListId && nextListId) {
      const nextList = await List.findOne({
        _id: nextListId,
        board: boardId,
        deleted_at: null,
      });
      if (!nextList) {
        return res.status(400).json({
          success: false,
          message: "nextListId không hợp lệ",
        });
      }
      newPos = nextList.pos / 2;
    }
    // Case 2: kéo xuống cuối (có prev, no next)
    else if (prevListId && !nextListId) {
      const prevList = await List.findOne({
        _id: prevListId,
        board: boardId,
        deleted_at: null,
      });
      if (!prevList) {
        return res.status(400).json({
          success: false,
          message: "prevListId không hợp lệ",
        });
      }
      newPos = prevList.pos + 65536;
    }
    // Case 3: kéo vào giữa (có cả prev và next)
    else if (prevListId && nextListId) {
      const [prevList, nextList] = await Promise.all([
        List.findOne({ _id: prevListId, board: boardId, deleted_at: null }),
        List.findOne({ _id: nextListId, board: boardId, deleted_at: null }),
      ]);

      if (!prevList || !nextList) {
        return res.status(400).json({
          success: false,
          message: "prevListId hoặc nextListId không hợp lệ",
        });
      }

      newPos = (prevList.pos + nextList.pos) / 2;
    }
    // Case 4: không thay đổi vị trí
    else {
      return res.status(200).json({
        success: true,
        message: "Vị trí không thay đổi",
        data: { list: currentList },
      });
    }

    // Update chỉ 1 list
    const updatedList = await List.findOneAndUpdate(
      {
        _id: listId,
        board: boardId,
        deleted_at: null,
      },
      { $set: { pos: newPos } },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedList) {
      return res.status(404).json({
        success: false,
        message: "Không thể cập nhật list",
      });
    }

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "list-moved",
      data: { listId: updatedList._id, pos: updatedList.pos },
      socketId: req.headers["x-socket-id"],
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật vị trí list thành công",
      data: {
        listId: updatedList._id,
        pos: updatedList.pos,
      },
    });
  } catch (error) {
    next(error);
  }
};
