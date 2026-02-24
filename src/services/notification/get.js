const Notification = require("../../models/Notification.model");

const getNotifications = async (userId, { page = 1, limit = 20, type } = {}) => {
    const query = { recipient: userId };

    if (type) {
        query.type = type;
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
            .sort({ create_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', '_id full_name avatar username')
            .populate('workspace', '_id title name type')
            .populate('board', '_id title type')
            .populate('card', '_id title cover'),
        Notification.countDocuments(query),
        Notification.countDocuments({ recipient: userId, is_read: false })
    ]);

    return {
        notifications,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit)
        },
        unread_count: unreadCount,
    };
};

const getUnreadCount = async (userId) => {
    return await Notification.countDocuments({
        recipient: userId,
        is_read: false
    });
};

module.exports = {
    getNotifications,
    getUnreadCount
};
