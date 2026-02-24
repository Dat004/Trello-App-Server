const Notification = require("../../models/Notification.model");
const User = require("../../models/User.model");
const Card = require("../../models/Card.model");
const Comment = require("../../models/Comment.model");
const Attachment = require("../../models/Attachment.model");
const Workspace = require("../../models/Workspace.model");
const Board = require("../../models/Board.model");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../../constants/activities");
const { emitToRoom, isUserOnline } = require("../../utils/socketHelper");
const { sendNotificationEmail } = require("../../services/email/send");

// Lấy key cài đặt thông báo dựa trên action
const getSettingKeyForAction = (action, isMention = false) => {
    if (isMention) return "mentions";

    switch (action) {
        case ACTIVITY_ACTIONS.CARD_MEMBER_ASSIGNED:
        case ACTIVITY_ACTIONS.CARD_MEMBER_REMOVED:
            return "card_assignments";
        case ACTIVITY_ACTIONS.COMMENT_CREATED:
            return "comments";
        case ACTIVITY_ACTIONS.CARD_UPDATED:
            return "due_reminders";
        case ACTIVITY_ACTIONS.MEMBER_ADDED:
        case ACTIVITY_ACTIONS.MEMBER_REMOVED:
        case ACTIVITY_ACTIONS.MEMBER_ROLE_CHANGED:
        case ACTIVITY_ACTIONS.MEMBER_INVITED:
        case ACTIVITY_ACTIONS.JOIN_REQUEST_APPROVED:
        case ACTIVITY_ACTIONS.JOIN_REQUEST_REJECTED:
            return "board_updates";
        case ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED:
        case ACTIVITY_ACTIONS.CHECKLIST_ITEM_ADDED:
        case ACTIVITY_ACTIONS.CHECKLIST_ITEM_COMPLETED:
            return "card_assignments";
        default:
            return null;
    }
};

// Kiểm tra cài đặt thông báo của user
const shouldNotifyUser = (user, settingKey) => {
    if (!user || !user.settings || !user.settings.notifications) return true;
    if (!settingKey) return true;

    const userSetting = user.settings.notifications[settingKey];
    // Nếu setting key không tồn tại mặc định là true
    return userSetting === undefined ? true : userSetting === true;
};

// Xử lý tạo và gửi notifications
const processNotificationBatch = async (notificationsData) => {
    if (!notificationsData || notificationsData.length === 0) return;

    // Lấy danh sách recipient IDs để query settings
    const recipientIds = notificationsData.map(n => n.recipient);

    // Fetch User Settings
    const users = await User.find({ _id: { $in: recipientIds } }).select("_id settings.notifications email");
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    // Filter dựa trên Settings và loại trừ Actor
    const validNotifications = notificationsData.filter(data => {
        const recipientId = data.recipient.toString();
        const actorId = data.sender.toString();

        // Không gửi cho chính mình
        if (recipientId === actorId) return false;

        // Kiểm tra setting cá nhân
        const user = userMap.get(recipientId);
        const isMention = data.message.includes("nhắc đến bạn");
        const settingKey = getSettingKeyForAction(data.type, isMention);

        return shouldNotifyUser(user, settingKey);
    });

    if (validNotifications.length === 0) {
        return;
    }

    // Insert vào DB
    const createdNotificationsRaw = await Notification.insertMany(validNotifications);
    const createdNotificationIds = createdNotificationsRaw.map(n => n._id);

    // Populate Full Info cho Socket và Email
    const createdNotifications = await Notification.find({ _id: { $in: createdNotificationIds } })
        .populate("sender", "_id full_name avatar username")
        .populate("workspace", "_id title name type")
        .populate("board", "_id title type")
        .populate("card", "_id title cover")
        .lean();

    // Socket Real-time & Send Email if Offline
    createdNotifications.forEach(notification => {
        const recipientId = notification.recipient.toString();

        // Gửi Socket
        emitToRoom({
            room: `user:${recipientId}`,
            event: "notification-new",
            data: notification,
            socketId: null
        });

        // Kiểm tra User Online/Offline để gửi Email
        const user = userMap.get(recipientId);
        const isOnline = isUserOnline(recipientId);
        const shouldSendEmail = user?.settings?.notifications?.email !== false;

        if (!isOnline && shouldSendEmail) {
            sendNotificationEmail(user, notification).catch(err =>
                console.error(`[Email Notification Error] Failed for ${user?.email}:`, err.message)
            );
        }
    });
};

// Phân tích activity để tạo thông báo
const generateNotificationsForActivity = async (activityDoc) => {
    try {
        // Chuyển Mongoose Document sang Plain Object
        const activity = activityDoc.toObject ? activityDoc.toObject() : activityDoc;
        const { action, entity_type, entity_id, workspace, board, actor, metadata = {} } = activity;
        const notificationsToCreate = [];

        // Helper để push vào queue
        const addNotify = (recipientId, message) => {
            if (recipientId && recipientId.toString() !== actor._id.toString()) {
                notificationsToCreate.push({
                    recipient: recipientId,
                    sender: actor._id,
                    type: action,
                    workspace,
                    board,
                    card: entity_type === ENTITY_TYPES.CARD ? entity_id : (metadata.card_id || undefined),
                    entity_id: entity_id,
                    entity_type: entity_type,
                    message
                });
            }
        };

        // CARDS (Membership, Due Date, Attachments, Checklists)
        if (entity_type === ENTITY_TYPES.CARD || metadata.card_id) {
            const cardId = entity_type === ENTITY_TYPES.CARD ? entity_id : metadata.card_id;
            const card = await Card.findById(cardId).select("members title");

            if (card) {
                const title = card.title;

                // Thêm/Gỡ thành viên
                if (action === ACTIVITY_ACTIONS.CARD_MEMBER_ASSIGNED) {
                    addNotify(metadata.member_id, `đã thêm bạn vào thẻ "${title}"`);
                } else if (action === ACTIVITY_ACTIONS.CARD_MEMBER_REMOVED) {
                    addNotify(metadata.member_id, `đã gỡ bạn khỏi thẻ "${title}"`);
                }

                // Cập nhật hạn chót
                else if (action === ACTIVITY_ACTIONS.CARD_UPDATED && activity.changes?.due_date) {
                    card.members.forEach(m => addNotify(m, `đã cập nhật hạn chót cho thẻ "${title}"`));
                }

                // Tệp đính kèm
                else if (action === ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED) {
                    card.members.forEach(m => addNotify(m, `đã đính kèm tệp vào thẻ "${title}"`));
                }

                // Checklist
                else if (action === ACTIVITY_ACTIONS.CHECKLIST_ITEM_ADDED) {
                    card.members.forEach(m => addNotify(m, `đã thêm công việc mới vào thẻ "${title}"`));
                } else if (action === ACTIVITY_ACTIONS.CHECKLIST_ITEM_COMPLETED) {
                    card.members.forEach(m => addNotify(m, `đã hoàn thành một công việc trong thẻ "${title}"`));
                }
            }
        }

        // COMMENTS (General & Mentions)
        else if (action === ACTIVITY_ACTIONS.COMMENT_CREATED) {
            const comment = await Comment.findById(entity_id).select("card mentions");
            if (comment && comment.card) {
                const card = await Card.findById(comment.card).select("members title");
                if (card) {
                    // Thông báo cho tất cả thành viên trong thẻ
                    card.members.forEach(m => {
                        notificationsToCreate.push({
                            recipient: m,
                            sender: actor._id,
                            type: action,
                            workspace, board,
                            card: card._id,
                            entity_id, entity_type: ENTITY_TYPES.COMMENT,
                            message: `đã bình luận trong thẻ "${card.title}"`
                        });
                    });

                    // Thông báo cho người được nhắc đến
                    if (comment.mentions && comment.mentions.length > 0) {
                        comment.mentions.forEach(userId => {
                            notificationsToCreate.push({
                                recipient: userId,
                                sender: actor._id,
                                type: action,
                                workspace, board,
                                card: card._id,
                                entity_id, entity_type: ENTITY_TYPES.COMMENT,
                                message: `đã nhắc đến bạn trong bình luận tại thẻ "${card.title}"`
                            });
                        });
                    }
                }
            }
        }

        // MEMBERSHIP (BOARDS & WORKSPACES)
        else if ([ACTIVITY_ACTIONS.MEMBER_ADDED, ACTIVITY_ACTIONS.MEMBER_REMOVED, ACTIVITY_ACTIONS.MEMBER_ROLE_CHANGED, ACTIVITY_ACTIONS.MEMBER_INVITED].includes(action)) {
            const isBoard = entity_type === ENTITY_TYPES.BOARD;
            let targetName = "";

            if (isBoard) {
                const b = await Board.findById(entity_id).select("title");
                targetName = b?.title || "Bảng";
            } else {
                const w = await Workspace.findById(entity_id).select("title name");
                targetName = w?.title || w?.name || "Workspace";
            }

            const entityName = isBoard ? "bảng" : "không gian làm việc";

            if (action === ACTIVITY_ACTIONS.MEMBER_ADDED) {
                addNotify(metadata.member_id, `đã thêm bạn vào ${entityName} "${targetName}"`);
            } else if (action === ACTIVITY_ACTIONS.MEMBER_INVITED) {
                addNotify(metadata.member_id, `đã mời bạn tham gia ${entityName} "${targetName}"`);
            } else if (action === ACTIVITY_ACTIONS.MEMBER_REMOVED) {
                addNotify(metadata.member_id, `đã xóa bạn khỏi ${entityName} "${targetName}"`);
            } else if (action === ACTIVITY_ACTIONS.MEMBER_ROLE_CHANGED) {
                const role = activity.changes?.role?.to || 'thành viên';
                addNotify(metadata.member_id, `đã cập nhật quyền của bạn thành "${role}" trong ${entityName} "${targetName}"`);
            }
        }

        // JOIN REQUESTS
        else if ([ACTIVITY_ACTIONS.JOIN_REQUEST_APPROVED, ACTIVITY_ACTIONS.JOIN_REQUEST_REJECTED].includes(action)) {
            let targetName = "vào hệ thống";
            if (board) {
                const b = await Board.findById(board).select("title");
                targetName = `vào bảng "${b?.title || "Bảng"}"`;
            } else if (workspace) {
                const w = await Workspace.findById(workspace).select("title name");
                targetName = `vào không gian làm việc "${w?.title || w?.name || "Workspace"}"`;
            }

            const message = action === ACTIVITY_ACTIONS.JOIN_REQUEST_APPROVED
                ? `đã chấp nhận yêu cầu tham gia của bạn ${targetName}`
                : `đã từ chối yêu cầu tham gia của bạn ${targetName}`;

            addNotify(metadata.request_user_id || metadata.member_id, message);
        }

        // Xử lý tạo và gửi thông báo
        // Lọc ra những thông báo không gửi cho chính mình
        const finalBatch = notificationsToCreate.filter(n => n.recipient.toString() !== actor._id.toString());
        await processNotificationBatch(finalBatch);

    } catch (error) {
        console.error("[Notification Generator] Critical Failure:", error);
    }
};

module.exports = {
    generateNotificationsForActivity
};
