const mongoose = require('mongoose');
const { ACTIVITY_ACTION_VALUES, ENTITY_TYPE_VALUES } = require('../constants/activities');

const Schema = mongoose.Schema;

const ActivitySchema = new Schema({
    // Loại hành động
    action: {
        type: String,
        enum: ACTIVITY_ACTION_VALUES,
        required: true,
        index: true
    },

    // Đối tượng bị tác động (Board, Workspace, Card, List, etc.)
    entity_type: {
        type: String,
        enum: ENTITY_TYPE_VALUES,
        required: true,
        index: true
    },

    entity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // Context: workspace hoặc board chứa entity này
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        default: null,
        index: true
    },

    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Board',
        default: null,
        index: true
    },

    // Người thực hiện hành động
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Chi tiết thay đổi (optional, flexible structure)
    // Example: { title: { from: 'Old', to: 'New' } }
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Metadata bổ sung (entity name, descriptions, etc)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    created_at: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes for efficient queries
ActivitySchema.index({ workspace: 1, created_at: -1 });
ActivitySchema.index({ board: 1, created_at: -1 });
ActivitySchema.index({ entity_type: 1, entity_id: 1, created_at: -1 });
ActivitySchema.index({ actor: 1, created_at: -1 });
ActivitySchema.index({ action: 1, created_at: -1 });

// Static methods for querying activities

// Lấy activities của workspace (bao gồm cả boards trong workspace)
ActivitySchema.statics.getWorkspaceActivities = function (workspaceId, options = {}) {
    const { limit = 50, page = 1, action } = options;
    const skip = (page - 1) * limit;

    const query = { workspace: workspaceId };
    if (action) query.action = action;

    return this.find(query)
        .populate('actor', '_id full_name avatar.url')
        .sort({ created_at: -1 })
        .limit(Math.min(limit, 100))
        .skip(skip);
};

// Lấy activities của board (bao gồm cả lists, cards, comments, attachments)
ActivitySchema.statics.getBoardActivities = function (boardId, options = {}) {
    const { limit = 50, page = 1, action } = options;
    const skip = (page - 1) * limit;

    const query = { board: boardId };
    if (action) query.action = action;

    return this.find(query)
        .populate('actor', '_id full_name avatar.url')
        .sort({ created_at: -1 })
        .limit(Math.min(limit, 100))
        .skip(skip);
};

// Lấy activities của user
ActivitySchema.statics.getUserActivities = function (userId, options = {}) {
    const { limit = 50, page = 1, action } = options;
    const skip = (page - 1) * limit;

    const query = { actor: userId };
    if (action) query.action = action;

    return this.find(query)
        .populate('workspace', '_id name')
        .populate('board', '_id title')
        .sort({ created_at: -1 })
        .limit(Math.min(limit, 100))
        .skip(skip);
};

module.exports = mongoose.model('Activity', ActivitySchema);
