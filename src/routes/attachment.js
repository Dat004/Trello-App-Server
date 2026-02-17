const express = require("express");
const router = express.Router({ mergeParams: true });

const authorize = require("../middlewares/permissionMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const PERMISSIONS = require("../permissions/definitions");
const AttachmentController = require("../controllers/AttachmentController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/cards/:cardId/attachments/:attachmentId
router.delete('/:attachmentId',
    protect,
    loadContext,
    authorize(PERMISSIONS.ATTACHMENT.DELETE),
    AttachmentController.destroyAttachment
);

// [POST] /api/boards/:boardId/cards/:cardId/attachments/create
router.post('/create',
    protect,
    loadContext,
    authorize(PERMISSIONS.ATTACHMENT.CREATE),
    AttachmentController.addAttachment
);

// [GET] /api/boards/:boardId/cards/:cardId/attachments
router.get('/',
    protect,
    loadContext,
    authorize(PERMISSIONS.CARD.VIEW),
    AttachmentController.getAttachmentsByCard
);

module.exports = router;
