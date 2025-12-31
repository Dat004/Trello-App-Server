const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireCardAccess, requireContentManager } = require("../middlewares/cardMiddleware");
const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const CommentController = require("../controllers/CommentController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/cards/:cardId/comments/:commentId
router.delete('/:commentId', protect, requireBoardAccess, requireCardAccess, requireContentManager, CommentController.destroyComment);

// [POST] /api/boards/:boardId/cards/:cardId/comments/create
router.post('/create', protect, requireBoardAccess, requireCardAccess, CommentController.addComment);

// [GET] /api/boards/:boardId/cards/:cardId/comments
router.get('/', protect, requireBoardAccess, requireCardAccess, CommentController.getCommentsByCard);

module.exports = router;
