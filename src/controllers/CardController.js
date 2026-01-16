const { deleteCard } = require("../services/card/delete");
const Card = require("../models/Card.model");
const List = require("../models/List.model");

const { cardSchema } = require("../utils/validationSchemas");

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

    const card = await Card.findOneAndUpdate(
      { _id: cardId, deleted_at: null },
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
    console.log(err);
    next(err);
  }
};

module.exports.delete = async (req, res, next) => {
  try {
    await deleteCard(req.params.cardId, { actor: req.user._id });

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

    const boardId = currentCard.board.toString();
    const sourceListId = currentCard.list.toString();
    const targetListId = destinationListId || sourceListId;

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

    let newPos;

    // Case 1: kéo lên đầu (no prev, có next)
    if (!prevCardId && nextCardId) {
      const nextCard = await Card.findOne({
        _id: nextCardId,
        list: targetListId,
        board: boardId,
        deleted_at: null,
      });

      if (!nextCard) {
        return res.status(400).json({
          success: false,
          message: "nextCardId không hợp lệ",
        });
      }

      newPos = nextCard.pos / 2;
    }

    // Case 2: kéo xuống cuối (có prev, no next)
    else if (prevCardId && !nextCardId) {
      const prevCard = await Card.findOne({
        _id: prevCardId,
        list: targetListId,
        board: boardId,
        deleted_at: null,
      });

      if (!prevCard) {
        return res.status(400).json({
          success: false,
          message: "prevCardId không hợp lệ",
        });
      }

      newPos = prevCard.pos + 65536;
    }

    // Case 3: kéo vào giữa (có cả prev và next)
    else if (prevCardId && nextCardId) {
      const [prevCard, nextCard] = await Promise.all([
        Card.findOne({
          _id: prevCardId,
          list: targetListId,
          board: boardId,
          deleted_at: null,
        }),
        Card.findOne({
          _id: nextCardId,
          list: targetListId,
          board: boardId,
          deleted_at: null,
        }),
      ]);

      if (!prevCard || !nextCard) {
        return res.status(400).json({
          success: false,
          message: "prevCardId hoặc nextCardId không hợp lệ",
        });
      }

      // Conflict detection (stale drag)
      if (prevCard.pos >= nextCard.pos) {
        return res.status(409).json({
          success: false,
          message: "Thứ tự card không hợp lệ (dữ liệu đã thay đổi)",
        });
      }

      newPos = (prevCard.pos + nextCard.pos) / 2;
    }

    // Case 4: không thay đổi vị trí
    else {
      return res.status(200).json({
        success: true,
        message: "Vị trí không thay đổi",
        data: { card: currentCard },
      });
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

    res.status(200).json({
      success: true,
      message: "Xóa checklist item thành công",
    });
  } catch (err) {
    next(err);
  }
};
