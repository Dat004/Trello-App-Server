const NotificationService = require("../services/notification/get");
const NotificationUpdateService = require("../services/notification/update");

// Lấy tất cả thông báo
module.exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await NotificationService.getNotifications(userId, { page, limit });
        const unreadCount = await NotificationService.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: {
                notifications: result.notifications,
                pagination: result.pagination,
                unread_count: unreadCount
            }
        });
    } catch (error) {
        next(error);
    }
};

// Lấy số lượng thông báo chưa đọc
module.exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const count = await NotificationService.getUnreadCount(userId);
        res.status(200).json({
            success: true,
            data: { count }
        });
    } catch (error) {
        next(error);
    }
};

// Đánh dấu đã đọc
module.exports.markAsRead = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const notificationId = req.params.id;

        const updated = await NotificationUpdateService.markAsRead(notificationId, userId);

        if (!updated) {
            return res.status(404).json({ success: false, message: "Thông báo không tồn tại" });
        }

        res.status(200).json({
            success: true,
            message: "Đã đánh dấu đã đọc",
            data: updated
        });
    } catch (error) {
        next(error);
    }
};

// Đánh dấu tất cả đã đọc
module.exports.markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user._id;
        await NotificationUpdateService.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            message: "Đã đánh dấu tất cả là đã đọc"
        });
    } catch (error) {
        next(error);
    }
};

// Xóa thông báo
module.exports.delete = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const notificationId = req.params.id;

        await NotificationUpdateService.deleteNotification(notificationId, userId);

        res.status(200).json({
            success: true,
            message: "Xóa thông báo thành công"
        });
    } catch (error) {
        next(error);
    }
};
