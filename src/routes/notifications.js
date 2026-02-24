const express = require("express");
const protect = require("../middlewares/authMiddleware");
const NotificationController = require("../controllers/NotificationController");
const router = express.Router();

router.use(protect);

// [DELETE] /api/notifications/:id
router.delete("/:id", NotificationController.delete);

// [PATCH] /api/notifications/read-all
router.patch("/read-all", NotificationController.markAllAsRead);

// [PATCH] /api/notifications/:id/read
router.patch("/:id/read", NotificationController.markAsRead);

// [GET] /api/notifications/unread-count
router.get("/unread-count", NotificationController.getUnreadCount);

// [GET] /api/notifications
router.get("/", NotificationController.getNotifications);

module.exports = router;
