const mongoose = require("mongoose");
const { ACTIVITY_ACTION_VALUES } = require("../constants/activities");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ACTIVITY_ACTION_VALUES,
        required: true,
    },
    workspace: {
        type: Schema.Types.ObjectId,
        ref: "Workspace",
    },
    board: {
        type: Schema.Types.ObjectId,
        ref: "Board",
    },
    card: {
        type: Schema.Types.ObjectId,
        ref: "Card",
    },
    entity_type: {
        type: String,
        enum: ["workspace", "board", "list", "card", "comment", "attachment", "member"],
        required: true,
    },
    entity_id: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    message: {
        type: String,
        default: "",
    },
    is_read: {
        type: Boolean,
        default: false,
        index: true,
    },
    create_at: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 90, // Tự động xóa sau 90 ngày
    },
});

module.exports = mongoose.model("Notification", NotificationSchema);
