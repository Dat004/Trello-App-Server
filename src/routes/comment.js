const express = require("express");
const router = express.Router({ mergeParams: true });

const authorize = require("../middlewares/permissionMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const PERMISSIONS = require("../permissions/definitions");
const CommentController = require("../controllers/CommentController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/cards/:cardId/comments/:commentId
router.delete('/:commentId',
    protect,
    loadContext,
    authorize(PERMISSIONS.COMMENT.DELETE),
    CommentController.destroyComment
);

// [POST] /api/boards/:boardId/cards/:cardId/comments/create
router.post('/create',
    protect,
    loadContext,
    authorize(PERMISSIONS.COMMENT.CREATE),
    CommentController.addComment
);

// [GET] /api/boards/:boardId/cards/:cardId/comments/:commentId/thread
router.get('/:commentId/thread',
    protect,
    loadContext,
    authorize(PERMISSIONS.CARD.VIEW),
    CommentController.getThread
);

// [GET] /api/boards/:boardId/cards/:cardId/comments
router.get('/',
    protect,
    loadContext,
    authorize(PERMISSIONS.CARD.VIEW),
    CommentController.getCommentsByCard
);

module.exports = router;
