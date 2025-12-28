const express = require('express');
const router = express.Router({ mergeParams: true });

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const CardController = require("../controllers/CardController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/:boardId/lists/:listId/cards/create
router.post('/create', protect, requireBoardAccess, CardController.create);

// [GET] /api/boards/:boardId/lists/:listId/cards
router.get('/', protect, requireBoardAccess, CardController.getCardsByList);

module.exports = router;
