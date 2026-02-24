const { deleteCard } = require("../services/card/delete");
const Card = require("../models/Card.model");
const List = require("../models/List.model");
const { emitToRoom } = require("../utils/socketHelper");

const { cardSchema } = require("../utils/validationSchemas");
const {
  logCardCreated,
  logCardUpdated,
  logCardDeleted,
  logCardMoved,
  logChecklistItemAdded,
  logChecklistItemCompleted,
} = require("../services/activity/log");

module.exports.getCardsByList = async (req, res, next) => {
  try {
    const cards = await Card.find({
      list: req.params.listId,
      deleted_at: null,
    }).sort({ pos: 1 });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách card thành công",
      data: { cards },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.getCardById = async (req, res, next) => {
  try {
    const card = await Card.findOne({
      _id: req.params.cardId,
      deleted_at: null,
    })
      .populate({
        path: "members",
        select: "_id full_name email avatar.url"
      });

    if (!card) {
      const err = new Error("Card không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: "Lấy card thành công",
      data: { card },
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
    const boardId = req.params.boardId;
    const workspaceId = req.board.workspace;

    const list = await List.findOne({ _id: listId, deleted_at: null });
    if (!list) {
      const err = new Error("List không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Tính pos mới: max pos + 65536
    const lastCard = await Card.findOne({
      list: listId,
      deleted_at: null,
    }).sort({ pos: -1 });
    const newPos = lastCard ? lastCard.pos + 65536 : 65536;

    const newCard = await Card.create({
      title,
      description,
      list: listId,
      board: boardId,
      workspace: workspaceId,
      pos: newPos,
      due_date: due_date || null,
      priority: priority || "medium",
      labels: labels || [],
      creator: req.user._id,
    });

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "card-created",
      data: { card: newCard },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logCardCreated(newCard, list, req.board, req.user._id);

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

    // Fetch old card data for change tracking
    const oldCard = await Card.findOne({ _id: cardId, deleted_at: null });
    if (!oldCard) {
      const err = new Error("Không tìm thấy card");
      err.statusCode = 404;
      return next(err);
    }

    const card = await Card.findOneAndUpdate(
      { _id: cardId, deleted_at: null },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    // Socket.io emit
    emitToRoom({
      room: `board:${card.board}`,
      event: "card-updated",
      data: { cardId: card._id, updates: validatedData },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity with proper from/to tracking
    const changes = {};
    if (validatedData.title && oldCard.title !== validatedData.title) {
      changes.title = { from: oldCard.title, to: validatedData.title };
    }
    if (validatedData.description !== undefined && oldCard.description !== validatedData.description) {
      changes.description = { from: oldCard.description, to: validatedData.description };
    }
    if (validatedData.due_date !== undefined && oldCard.due_date !== validatedData.due_date) {
      changes.due_date = { from: oldCard.due_date, to: validatedData.due_date };
    }
    if (validatedData.priority && oldCard.priority !== validatedData.priority) {
      changes.priority = { from: oldCard.priority, to: validatedData.priority };
    }
    if (Object.keys(changes).length > 0) {
      const list = await List.findById(card.list);
      logCardUpdated(card, list, req.board, req.user._id, changes);
    }

    res.status(201).json({
      success: true,
      message: "Cập nhật thông tin card thành công",
      data: { card },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.delete = async (req, res, next) => {
  try {
    const { cardId, boardId } = req.params;
    const card = req.card;
    const list = await List.findById(card.list);

    await deleteCard(cardId, { actor: req.user._id });

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "card-deleted",
      data: { cardId },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logCardDeleted(card, list, req.board, req.user._id);

    res.status(201).json({
      success: true,
      message: "Xóa card thành công",
    });
  } catch (err) {
    next(err);
  }
};

// Move card
module.exports.moveCard = async (req, res, next) => {
  try {
    const { prevCardId, nextCardId, destinationListId } = req.body;
    const { cardId } = req.params;

    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu cardId",
      });
    }

    // Lấy card hiện tại
    const currentCard = await Card.findOne({ _id: cardId, deleted_at: null });
    if (!currentCard) {
      return res.status(404).json({
        success: false,
        message: "Card không tồn tại",
      });
    }

    const boardId = req.params.boardId;
    const sourceListId = currentCard.list.toString();
    const targetListId = destinationListId || sourceListId;

    // Check: Card phải thuộc về board hiện tại
    if (currentCard.board.toString() !== boardId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền di chuyển card này hoặc card không thuộc board này",
      });
    }

    // Validate list đích cùng board
    const targetList = await List.findOne({
      _id: targetListId,
      board: boardId,
      deleted_at: null,
    });

    if (!targetList) {
      return res.status(400).json({
        success: false,
        message: "List đích không hợp lệ hoặc khác board",
      });
    }

    // 3. Lấy thông tin các card lân cận (nếu có)
    const [prevCard, nextCard] = await Promise.all([
      prevCardId
        ? Card.findOne({
          _id: prevCardId,
          list: targetListId,
          board: boardId,
          deleted_at: null,
        })
        : null,
      nextCardId
        ? Card.findOne({
          _id: nextCardId,
          list: targetListId,
          board: boardId,
          deleted_at: null,
        })
        : null,
    ]);

    // Kiểm tra tính hợp lệ của card lân cận
    if (prevCardId && !prevCard) {
      return res.status(400).json({
        success: false,
        message: "prevCardId không tồn tại hoặc không thuộc list đích",
      });
    }
    if (nextCardId && !nextCard) {
      return res.status(400).json({
        success: false,
        message: "nextCardId không tồn tại hoặc không thuộc list đích",
      });
    }

    let newPos;

    // Case 1: Không có cả prev và next (List trống hoặc FE không gửi vị trí cụ thể)
    if (!prevCard && !nextCard) {
      if (targetListId !== sourceListId) {
        // Tìm card có pos cao nhất trong list đích để cộng thêm
        // Điều này giúp card luôn nằm ở cuối ngay cả khi list không thực sự trống
        const lastCard = await Card.findOne({
          list: targetListId,
          deleted_at: null,
        }).sort({ pos: -1 });
        newPos = lastCard ? lastCard.pos + 65536 : 65536;
      } else {
        return res.status(200).json({
          success: true,
          message: "Vị trí không thay đổi",
          data: { card: currentCard },
        });
      }
    }
    // Case 2: Di chuyển lên đầu (chỉ có next)
    else if (!prevCard && nextCard) {
      newPos = nextCard.pos / 2;
    }
    // Case 3: Di chuyển xuống cuối (chỉ có prev)
    else if (prevCard && !nextCard) {
      newPos = prevCard.pos + 65536;
    }
    // Case 4: Di chuyển vào giữa
    else {
      // Bảo vệ chống dữ liệu cũ (Conflict detection)
      if (prevCard.pos >= nextCard.pos) {
        return res.status(409).json({
          success: false,
          message: "Xung đột vị trí: Dữ liệu trên giao diện có thể đã cũ",
        });
      }
      newPos = (prevCard.pos + nextCard.pos) / 2;
    }

    const updatedCard = await Card.findOneAndUpdate(
      {
        _id: cardId,
        board: boardId,
        deleted_at: null,
      },
      {
        $set: {
          list: targetListId,
          pos: newPos,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: "Không thể cập nhật card",
      });
    }

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "card-moved",
      data: {
        cardId: updatedCard._id,
        listId: updatedCard.list,
        pos: updatedCard.pos,
        sourceListId,
        targetListId,
      },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity if moved to different list (general move, no specific positions)
    if (sourceListId !== targetListId) {
      const fromList = await List.findById(sourceListId);
      const toList = await List.findById(targetListId);
      logCardMoved(updatedCard, fromList, toList, req.board, req.user._id);
    }

    res.status(200).json({
      success: true,
      message: "Di chuyển card thành công",
      data: {
        cardId: updatedCard._id,
        listId: updatedCard.list,
        pos: updatedCard.pos,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.assignMember = async (req, res, next) => {
  try {
    const { assignCardMemberSchema } = require("../utils/validationSchemas");
    const { userId } = assignCardMemberSchema.parse(req.body);
    const { cardId, boardId } = req.params;
    const User = require("../models/User.model");
    const Board = require("../models/Board.model");
    const { logCardMemberAssigned } = require("../services/activity/log");

    // Lấy card hiện tại
    const card = await Card.findOne({ _id: cardId, deleted_at: null });
    if (!card) {
      const err = new Error("Card không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error("User không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Kiểm tra user có phải là board member không
    const board = req.board;
    const isBoardMember = board.members.some(m => m.user.equals(userId)) ||
      board.owner.equals(userId);

    if (!isBoardMember) {
      const err = new Error("Chỉ có thể giao thẻ cho thành viên của board");
      err.statusCode = 403;
      return next(err);
    }

    // Kiểm tra user đã được assign chưa
    if (card.members.some(memberId => memberId.equals(userId))) {
      const err = new Error("User đã được giao thẻ này rồi");
      err.statusCode = 400;
      return next(err);
    }

    // Assign member vào card
    card.members.push(userId);
    await card.save();

    // Populate member info
    await card.populate({
      path: "members",
      select: "_id full_name email avatar.url"
    });

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "card-member-assigned",
      data: {
        cardId: card._id,
        member: card.members[card.members.length - 1]
      },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logCardMemberAssigned(card, board, user, req.user._id);

    res.status(200).json({
      success: true,
      message: "Giao thẻ cho thành viên thành công",
      data: {
        cardId: card._id,
        member: card.members[card.members.length - 1]
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.removeMember = async (req, res, next) => {
  try {
    const { cardId, boardId, userId } = req.params;
    const User = require("../models/User.model");
    const { logCardMemberRemoved } = require("../services/activity/log");

    // Lấy card hiện tại
    const card = await Card.findOne({ _id: cardId, deleted_at: null });
    if (!card) {
      const err = new Error("Card không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    // Kiểm tra user có trong card members không
    if (!card.members.some(memberId => memberId.equals(userId))) {
      const err = new Error("User không có trong thẻ này");
      err.statusCode = 400;
      return next(err);
    }

    // Lấy user info trước khi remove (để log)
    const user = await User.findById(userId);

    // Remove member khỏi card
    card.members = card.members.filter(memberId => !memberId.equals(userId));
    await card.save();

    // Socket.io emit
    emitToRoom({
      room: `board:${boardId}`,
      event: "card-member-removed",
      data: {
        cardId: card._id,
        userId
      },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    if (user) {
      logCardMemberRemoved(card, req.board, user, req.user._id);
    }

    res.status(200).json({
      success: true,
      message: "Gỡ thành viên khỏi thẻ thành công",
    });
  } catch (err) {
    next(err);
  }
};

module.exports.getCardMembers = async (req, res, next) => {
  try {
    const { cardId } = req.params;

    const card = await Card.findOne({ _id: cardId, deleted_at: null })
      .populate({
        path: "members",
        select: "_id full_name email avatar.url"
      });

    if (!card) {
      const err = new Error("Card không tồn tại");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: "Lấy danh sách thành viên của thẻ thành công",
      data: { members: card.members },
    });
  } catch (err) {
    next(err);
  }
}

module.exports.addChecklistItem = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      const err = new Error("Nội dung checklist không được để trống.");
      err.statusCode = 400;
      return next(err);
    }

    const newChecklistItem = {
      text: text.trim(),
      completed: false,
    };

    const card = await Card.findOneAndUpdate(
      { _id: req.params.cardId, deleted_at: null },
      { $push: { checklist: newChecklistItem } },
      { new: true, runValidators: true }
    );
    if (!card) {
      const err = new Error("Không tìm thấy card.");
      err.statusCode = 404;
      return next(err);
    }

    // Lấy checklist item vừa được thêm (item cuối cùng trong mảng)
    const addedChecklistItem = card.checklist[card.checklist.length - 1];

    // Socket.io emit
    emitToRoom({
      room: `board:${card.board}`,
      event: "checklist-item-added",
      data: { cardId: card._id, checklist: addedChecklistItem },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity
    logChecklistItemAdded(card, req.board, req.user._id, addedChecklistItem.text);

    res.status(200).json({
      success: true,
      message: "Thêm checklist mới thành công",
      data: { checklist: addedChecklistItem },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.toggleChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.body;
    const { cardId, boardId } = req.params;

    if (!checklistId) {
      const err = new Error("checklistId không hợp lệ");
      err.statusCode = 400;
      return next(err);
    }

    const card = await Card.findOne({
      _id: cardId,
      board: boardId,
      deleted_at: null,
    });
    if (!card) {
      const err = new Error("Không tìm thấy card.");
      err.statusCode = 404;
      return next(err);
    }

    // Kiểm tra checklist được click có tồn tại trong danh sách checklists không
    const item = card.checklist.id(checklistId);
    if (!item) {
      const err = new Error("Không tìm thấy checklist.");
      err.statusCode = 404;
      return next(err);
    }

    const updatedCard = await Card.findOneAndUpdate(
      {
        _id: cardId,
        board: boardId,
        deleted_at: null,
      },
      {
        $set: {
          "checklist.$[elem].completed": !item.completed,
        },
      },
      {
        arrayFilters: [{ "elem._id": checklistId }],
        new: true,
        runValidators: true,
      }
    );

    // Lấy checklist item đã được cập nhật
    const updatedChecklistItem = updatedCard.checklist.id(checklistId);

    // Socket.io emit
    emitToRoom({
      room: `board:${updatedCard.board}`,
      event: "checklist-item-toggled",
      data: { cardId: updatedCard._id, checklist: updatedChecklistItem },
      socketId: req.headers["x-socket-id"],
    });

    // Log activity if completed
    if (updatedChecklistItem.completed) {
      logChecklistItemCompleted(updatedCard, req.board, req.user._id, updatedChecklistItem.text);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái checklist thành công",
      data: {
        checklist: updatedChecklistItem,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.destroyChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.body;
    if (!checklistId) {
      const err = new Error("checklistId không hợp lệ");
      err.statusCode = 400;
      return next(err);
    }

    const updatedCard = await Card.findOneAndUpdate(
      { _id: req.params.cardId, deleted_at: null },
      {
        $pull: {
          checklist: { _id: checklistId },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: "Card không tồn tại",
      });
    }

    // Socket.io emit
    emitToRoom({
      room: `board:${updatedCard.board}`,
      event: "checklist-item-deleted",
      data: { cardId: updatedCard._id, checklistId },
      socketId: req.headers["x-socket-id"],
    });

    res.status(200).json({
      success: true,
      message: "Xóa checklist item thành công",
    });
  } catch (err) {
    next(err);
  }
};
