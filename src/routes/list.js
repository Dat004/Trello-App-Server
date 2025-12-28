const express = require("express");
const router = express.Router();

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const ListController = require("../controllers/ListController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/:boardId/lists/create
router.post('/create', protect, requireBoardAccess, ListController.create);

// [GET] /api/boards/:boardId/lists
router.get('/', protect, requireBoardAccess, ListController.getBoardLists);

module.exports = router;
