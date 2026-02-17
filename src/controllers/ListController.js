const { listSchema } = require("../utils/validationSchemas");
const { deleteList } = require("../services/list/delete");
const List = require("../models/List.model");
const { emitToRoom } = require("../utils/socketHelper");
const {
  logListCreated,
  logListUpdated,
  logListDeleted,
  logListMoved,
} = require("../services/activity/log");

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

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "list-created",
      data: { list: newList },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logListCreated(newList, req.board, req.user._id);

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
  } catch (error) {
    next(error);
  }
};

// Update list
module.exports.updateList = async (req, res, next) => {
  try {
    const validatedData = listSchema.parse(req.body);

    // Fetch old list data for change tracking
    const oldList = await List.findOne({
      _id: req.params.listId,
      deleted_at: null,
    });

    if (!oldList) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    const updatedList = await List.findOneAndUpdate(
      {
        _id: req.params.listId,
        deleted_at: null,
      },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    // Socket.io emit
    emitToRoom({
      room: `board:${req.params.boardId}`,
      event: "list-updated",
      data: { listId: updatedList._id, list: updatedList },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity with proper change tracking
    const changes = {};
    if (validatedData.title && oldList.title !== validatedData.title) {
      changes.title = { from: oldList.title, to: validatedData.title };
    }
    if (validatedData.color && oldList.color !== validatedData.color) {
      changes.color = { from: oldList.color, to: validatedData.color };
    }
    if (Object.keys(changes).length > 0) {
      logListUpdated(updatedList, req.board, req.user._id, changes);
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
    const { listId, boardId } = req.params;

    // Fetch list before deletion for logging
    const list = await List.findOne({
      _id: listId,
      deleted_at: null,
    });

    if (!list) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    await deleteList(listId, { actor: req.user._id });

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "list-deleted",
      data: { listId },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logListDeleted(list, req.board, req.user._id);

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

    // Log activity (general position change, no specific from/to)
    logListMoved(updatedList, req.board, req.user._id, null, null);

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
