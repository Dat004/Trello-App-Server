const Notification = require("../../models/Notification.model");

const markAsRead = async (notificationId, userId) => {
    // Chỉ đánh dấu nếu thuộc về user
    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { is_read: true },
        { new: true }
    );
    return notification;
};

const markAllAsRead = async (userId) => {
    return await Notification.updateMany(
        { recipient: userId, is_read: false },
        { is_read: true }
    );
};

const deleteNotification = async (notificationId, userId) => {
    return await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
};

module.exports = {
    markAsRead,
    markAllAsRead,
    deleteNotification
};
