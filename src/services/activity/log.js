const Activity = require('../../models/Activity.model');
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require('../../constants/activities');
const { emitToRoom } = require('../../utils/socketHelper');
const { generateNotificationsForActivity } = require('../../services/notification/create');

// Log activity vào database
const logActivity = async ({
    action,
    entityType,
    entityId,
    workspace = null,
    board = null,
    actor,
    changes = {},
    metadata = {}
}) => {
    try {
        const activity = await Activity.create({
            action,
            entity_type: entityType,
            entity_id: entityId,
            workspace,
            board,
            actor,
            changes,
            metadata
        });

        if (activity) {
            // Populate actor
            await activity.populate('actor', '_id full_name avatar.url');
            broadcastActivity(activity);

            // Trigger notification generation (async, non-blocking)
            setImmediate(() => {
                generateNotificationsForActivity(activity).catch(err =>
                    console.error('[Notification Trigger] Failed:', err)
                );
            });
        }

        return activity;
    } catch (error) {
        // Log error
        console.error('[Activity Logger] Failed to log activity:', {
            action,
            entityType,
            entityId,
            error: error.message
        });
    }
};

// Xử lý broadcast activity
const broadcastActivity = (activity) => {
    try {
        const activityData = activity.toObject ? activity.toObject() : activity;

        // Chỉ broadcast đến workspace room nếu workspace tồn tại   
        if (activityData.workspace) {
            emitToRoom({
                room: `workspace:${activityData.workspace}`,
                event: 'activity-created',
                data: activityData
            });
        }

        // Chỉ broadcast đến board room nếu board tồn tại
        if (activityData.board) {
            emitToRoom({
                room: `board:${activityData.board}`,
                event: 'activity-created',
                data: activityData
            });
        }
    } catch (error) {
        console.error('[Activity Broadcast] Failed to broadcast activity:', error.message);
    }
};

// Helper functions cho từng loại entity
// Workspace activities
const logWorkspaceCreated = (workspace, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.WORKSPACE_CREATED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        metadata: {
            workspace_name: workspace.name
        }
    });
};

const logWorkspaceUpdated = (workspace, actor, changes) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.WORKSPACE_UPDATED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        changes,
        metadata: {
            workspace_name: workspace.name
        }
    });
};

const logWorkspaceDeleted = (workspace, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.WORKSPACE_DELETED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        metadata: {
            workspace_name: workspace.name
        }
    });
};

// Board activities
const logBoardCreated = (board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_CREATED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title
        }
    });
};

const logBoardUpdated = (board, actor, changes) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_UPDATED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        changes,
        metadata: {
            board_title: board.title
        }
    });
};

const logBoardDeleted = (board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_DELETED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title
        }
    });
};

const logBoardArchived = (board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_ARCHIVED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title
        }
    });
};

const logBoardRestored = (board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_RESTORED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title
        }
    });
};

const logBoardMovedToWorkspace = (board, workspace, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_MOVED_TO_WORKSPACE,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: workspace._id,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title,
            workspace_name: workspace.name
        }
    });
};

const logBoardRemovedFromWorkspace = (board, workspace, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.BOARD_REMOVED_FROM_WORKSPACE,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: workspace._id,
        board: board._id,
        actor,
        metadata: {
            board_title: board.title,
            workspace_name: workspace.name
        }
    });
};

// Member activities
const logMemberAdded = ({ entityType, entityId, workspace, board, member, role, actor }) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.MEMBER_ADDED,
        entityType,
        entityId,
        workspace,
        board,
        actor,
        metadata: {
            member_id: member._id,
            member_name: member.full_name || member.email,
            role
        }
    });
};

const logMemberRemoved = ({ entityType, entityId, workspace, board, member, actor }) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.MEMBER_REMOVED,
        entityType,
        entityId,
        workspace,
        board,
        actor,
        metadata: {
            member_id: member._id,
            member_name: member.full_name || member.email
        }
    });
};

const logMemberRoleChanged = ({ entityType, entityId, workspace, board, member, oldRole, newRole, actor }) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.MEMBER_ROLE_CHANGED,
        entityType,
        entityId,
        workspace,
        board,
        actor,
        changes: {
            role: { from: oldRole, to: newRole }
        },
        metadata: {
            member_id: member._id,
            member_name: member.full_name || member.email
        }
    });
};

// Permission changes (workspace only)
const logPermissionChanged = (workspace, actor, changes) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.PERMISSION_CHANGED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        changes
    });
};

// Join request activities
const logJoinRequestApproved = (workspace, actor, requestUser) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.JOIN_REQUEST_APPROVED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        metadata: {
            request_user_id: requestUser._id,
            request_user_name: requestUser.full_name || requestUser.email
        }
    });
};

const logJoinRequestRejected = (workspace, actor, requestUser) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.JOIN_REQUEST_REJECTED,
        entityType: ENTITY_TYPES.WORKSPACE,
        entityId: workspace._id,
        workspace: workspace._id,
        board: null,
        actor,
        metadata: {
            request_user_id: requestUser._id,
            request_user_name: requestUser.full_name || requestUser.email
        }
    });
};

const logBoardJoinRequestApproved = (board, actor, requestUser) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.JOIN_REQUEST_APPROVED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            request_user_id: requestUser._id,
            request_user_name: requestUser.full_name || requestUser.email,
            board_title: board.title
        }
    });
};

const logBoardJoinRequestRejected = (board, actor, requestUser) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.JOIN_REQUEST_REJECTED,
        entityType: ENTITY_TYPES.BOARD,
        entityId: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor,
        metadata: {
            request_user_id: requestUser._id,
            request_user_name: requestUser.full_name || requestUser.email,
            board_title: board.title
        }
    });
};

// List activities
const logListCreated = (list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.LIST_CREATED,
        entityType: ENTITY_TYPES.LIST,
        entityId: list._id,
        workspace: list.workspace || null,
        board: board._id,
        actor,
        metadata: {
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logListUpdated = (list, board, actor, changes) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.LIST_UPDATED,
        entityType: ENTITY_TYPES.LIST,
        entityId: list._id,
        workspace: list.workspace || null,
        board: board._id,
        actor,
        changes,
        metadata: {
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logListDeleted = (list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.LIST_DELETED,
        entityType: ENTITY_TYPES.LIST,
        entityId: list._id,
        workspace: list.workspace || null,
        board: board._id,
        actor,
        metadata: {
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logListMoved = (list, board, actor, fromPosition, toPosition) => {
    const activityData = {
        action: ACTIVITY_ACTIONS.LIST_MOVED,
        entityType: ENTITY_TYPES.LIST,
        entityId: list._id,
        workspace: list.workspace || null,
        board: board._id,
        actor,
        metadata: {
            list_title: list.title,
            board_title: board.title
        }
    };

    // Only add position changes if they are provided
    if (fromPosition !== null && toPosition !== null) {
        activityData.changes = {
            position: { from: fromPosition, to: toPosition }
        };
    }

    return logActivity(activityData);
};

// Card activities
const logCardCreated = (card, list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_CREATED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logCardUpdated = (card, list, board, actor, changes) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_UPDATED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        changes,
        metadata: {
            card_title: card.title,
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logCardDeleted = (card, list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_DELETED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logCardMoved = (card, fromList, toList, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_MOVED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        changes: {
            list: {
                from: fromList.title,
                to: toList.title
            }
        },
        metadata: {
            card_title: card.title,
            board_title: board.title
        }
    });
};

const logCardArchived = (card, list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_ARCHIVED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            list_title: list.title,
            board_title: board.title
        }
    });
};

const logCardRestored = (card, list, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_RESTORED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            list_title: list.title,
            board_title: board.title
        }
    });
};

// Comment activities
const logCommentCreated = (comment, card, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.COMMENT_CREATED,
        entityType: ENTITY_TYPES.COMMENT,
        entityId: comment._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            board_title: board.title
        }
    });
};

const logCommentUpdated = (comment, card, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.COMMENT_UPDATED,
        entityType: ENTITY_TYPES.COMMENT,
        entityId: comment._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            board_title: board.title
        }
    });
};

const logCommentDeleted = (comment, card, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.COMMENT_DELETED,
        entityType: ENTITY_TYPES.COMMENT,
        entityId: comment._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            board_title: board.title
        }
    });
};

// Attachment activities
const logAttachmentUploaded = (attachment, card, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED,
        entityType: ENTITY_TYPES.ATTACHMENT,
        entityId: attachment._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            attachment_name: attachment.name || attachment.filename,
            card_title: card.title,
            board_title: board.title
        }
    });
};

const logAttachmentDeleted = (attachment, card, board, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.ATTACHMENT_DELETED,
        entityType: ENTITY_TYPES.ATTACHMENT,
        entityId: attachment._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            attachment_name: attachment.name || attachment.filename,
            card_title: card.title,
            board_title: board.title
        }
    });
};

// Card member activities
const logCardMemberAssigned = (card, board, member, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_MEMBER_ASSIGNED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            board_title: board.title,
            member_id: member._id,
            member_name: member.full_name || member.email
        }
    });
};

const logCardMemberRemoved = (card, board, member, actor) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CARD_MEMBER_REMOVED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || null,
        board: board._id,
        actor,
        metadata: {
            card_title: card.title,
            board_title: board.title,
            member_id: member._id,
            member_name: member.full_name || member.email
        }
    });
};

const logChecklistItemAdded = (card, board, actor, itemText) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CHECKLIST_ITEM_ADDED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || board.workspace,
        board: board._id,
        actor,
        metadata: {
            card_id: card._id,
            card_title: card.title,
            checklist_text: itemText
        }
    });
};

const logChecklistItemCompleted = (card, board, actor, itemText) => {
    return logActivity({
        action: ACTIVITY_ACTIONS.CHECKLIST_ITEM_COMPLETED,
        entityType: ENTITY_TYPES.CARD,
        entityId: card._id,
        workspace: card.workspace || board.workspace,
        board: board._id,
        actor,
        metadata: {
            card_id: card._id,
            card_title: card.title,
            checklist_text: itemText
        }
    });
};

module.exports = {
    logActivity,

    // Workspace
    logWorkspaceCreated,
    logWorkspaceUpdated,
    logWorkspaceDeleted,

    // Board
    logBoardCreated,
    logBoardUpdated,
    logBoardDeleted,
    logBoardArchived,
    logBoardRestored,
    logBoardMovedToWorkspace,
    logBoardRemovedFromWorkspace,

    // Members
    logMemberAdded,
    logMemberRemoved,
    logMemberRoleChanged,

    // Permissions & Join Requests
    logPermissionChanged,
    logJoinRequestApproved,
    logJoinRequestRejected,
    logBoardJoinRequestApproved,
    logBoardJoinRequestRejected,

    // List
    logListCreated,
    logListUpdated,
    logListDeleted,
    logListMoved,

    // Card
    logCardCreated,
    logCardUpdated,
    logCardDeleted,
    logCardMoved,
    logCardArchived,
    logCardRestored,
    logCardMemberAssigned,
    logCardMemberRemoved,

    // Checklist
    logChecklistItemAdded,
    logChecklistItemCompleted,

    // Comment
    logCommentCreated,
    logCommentUpdated,
    logCommentDeleted,

    // Attachment
    logAttachmentUploaded,
    logAttachmentDeleted
};
