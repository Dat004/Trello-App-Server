const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const UserFavoritesSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    starred_workspaces: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
        },
    ],
    starred_boards: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Board",
        },
    ],
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
});

// Unique constraint: 1 user chỉ có 1 document
UserFavoritesSchema.index({ user: 1 }, { unique: true });

// Auto update updated_at
UserFavoritesSchema.pre("save", function () {
    this.updated_at = Date.now();
});

module.exports = mongoose.model("UserFavorites", UserFavoritesSchema);
