const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const { requireCardAccess } = require("../middlewares/cardMiddleware");
const AttachmentController = require("../controllers/AttachmentController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/:boardId/cards/:cardId/attachments/create
router.post('/create', protect, requireBoardAccess, requireCardAccess, AttachmentController.addAttachment);

// [GET] /api/boards/:boardId/cards/:cardId/attachments
router.get('/', protect, requireBoardAccess, requireCardAccess, AttachmentController.getAttachmentsByCard);

module.exports = router;
