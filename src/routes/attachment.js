const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireCardAccess, requireContentManager } = require("../middlewares/cardMiddleware");
const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const AttachmentController = require("../controllers/AttachmentController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/cards/:cardId/attachments/:attachmentId
router.delete('/:attachmentId', protect, requireBoardAccess, requireCardAccess, requireContentManager, AttachmentController.destroyAttachment);

// [POST] /api/boards/:boardId/cards/:cardId/attachments/create
router.post('/create', protect, requireBoardAccess, requireCardAccess, AttachmentController.addAttachment);

// [GET] /api/boards/:boardId/cards/:cardId/attachments
router.get('/', protect, requireBoardAccess, requireCardAccess, AttachmentController.getAttachmentsByCard);

module.exports = router;
