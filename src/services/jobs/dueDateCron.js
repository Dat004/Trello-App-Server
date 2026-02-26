const cron = require("node-cron");
const Card = require("../../models/Card.model");
const User = require("../../models/User.model");
const Notification = require("../../models/Notification.model");
const { generateNotificationsForActivity } = require("../notification/create");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../../constants/activities");

// Job quét các card sắp đến hạn trong vòng 24h
const initDueDateReminders = () => {
    // Chạy mỗi giờ
    cron.schedule("0 * * * *", async () => {
        console.log("[Cron Job] Checking for due date reminders...");
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Tìm các card có due_date trong 24h tới
            const cards = await Card.find({
                due_date: { $gte: now, $lte: tomorrow },
                deleted_at: null
            }).populate("members", "_id");

            if (cards.length === 0) return;

            for (const card of cards) {
                const hoursLeft = Math.round((card.due_date - now) / (1000 * 60 * 60));
                // Kiểm tra xem đã có reminder nào gửi trong 24h qua cho card này chưa
                const recentReminder = await Notification.findOne({
                    card: card._id,
                    type: ACTIVITY_ACTIONS.DUE_DATE_REMINDER,
                    create_at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                if (recentReminder) continue;

                // Gửi thông báo cho từng thành viên trong card
                for (const member of card.members) {
                    await generateNotificationsForActivity({
                        action: ACTIVITY_ACTIONS.DUE_DATE_REMINDER,
                        entity_type: ENTITY_TYPES.CARD,
                        entity_id: card._id,
                        workspace: card.workspace,
                        board: card.board,
                        recipient: member._id,
                        actor: { _id: card.creator },
                        metadata: {
                            card_id: card._id,
                            card_title: card.title,
                            hours_left: hoursLeft
                        }
                    });
                }
            }
        } catch (error) {
            console.error("[Cron Job Error] Due Date Reminders failed:", error);
        }
    });

    console.log("[Job Manager] Due Date Reminders scheduled (Hourly)");
};

module.exports = { initDueDateReminders };
