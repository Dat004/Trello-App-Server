const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireBoardAccess, requireBoardAdmin } = require("../middlewares/boardMiddleware");
const ListController = require("../controllers/ListController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/lists/:listId
router.delete('/:listId', protect, requireBoardAccess, requireBoardAdmin, ListController.deleteList);

// [PATCH] /api/boards/:boardId/lists/move
router.patch('/move', protect, requireBoardAccess, requireBoardAdmin, ListController.updateListPosition);

// [PATCH] /api/boards/:boardId/lists/:listId
router.patch('/:listId', protect, requireBoardAccess, requireBoardAdmin, ListController.updateList);

// [POST] /api/boards/:boardId/lists/create
router.post('/create', protect, requireBoardAccess, ListController.create);

// [GET] /api/boards/:boardId/lists
router.get('/', protect, requireBoardAccess, ListController.getBoardLists);

module.exports = router;
