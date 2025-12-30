const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const { requireCardAccess } = require("../middlewares/cardMiddleware");
const CommentController = require("../controllers/CommentController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/:boardId/cards/:cardId/comments/create
router.post('/create', protect, requireBoardAccess, requireCardAccess, CommentController.addComment);

// [GET] /api/boards/:boardId/cards/:cardId/comments
router.get('/', protect, requireBoardAccess, requireCardAccess, CommentController.getCommentsByCard);

module.exports = router;
