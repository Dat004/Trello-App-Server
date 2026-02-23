// Định nghĩa các hành động và entity types
const ACTIVITY_ACTIONS = {
    // Workspace actions
    WORKSPACE_CREATED: 'workspace_created',
    WORKSPACE_UPDATED: 'workspace_updated',
    WORKSPACE_DELETED: 'workspace_deleted',

    // Board actions
    BOARD_CREATED: 'board_created',
    BOARD_UPDATED: 'board_updated',
    BOARD_DELETED: 'board_deleted',
    BOARD_ARCHIVED: 'board_archived',
    BOARD_RESTORED: 'board_restored',
    BOARD_MOVED_TO_WORKSPACE: 'board_moved_to_workspace',
    BOARD_REMOVED_FROM_WORKSPACE: 'board_removed_from_workspace',

    // Member actions (workspace & board)
    MEMBER_ADDED: 'member_added',
    MEMBER_REMOVED: 'member_removed',
    MEMBER_ROLE_CHANGED: 'member_role_changed',

    // Permission actions (workspace)
    PERMISSION_CHANGED: 'permission_changed',

    // Join request actions (workspace)
    JOIN_REQUEST_APPROVED: 'join_request_approved',
    JOIN_REQUEST_REJECTED: 'join_request_rejected',

    // List actions
    LIST_CREATED: 'list_created',
    LIST_UPDATED: 'list_updated',
    LIST_DELETED: 'list_deleted',
    LIST_MOVED: 'list_moved',

    // Card actions
    CARD_CREATED: 'card_created',
    CARD_UPDATED: 'card_updated',
    CARD_DELETED: 'card_deleted',
    CARD_MOVED: 'card_moved',
    CARD_ARCHIVED: 'card_archived',
    CARD_RESTORED: 'card_restored',
    CARD_MEMBER_ASSIGNED: 'card_member_assigned',
    CARD_MEMBER_REMOVED: 'card_member_removed',

    // Comment actions
    COMMENT_CREATED: 'comment_created',
    COMMENT_UPDATED: 'comment_updated',
    COMMENT_DELETED: 'comment_deleted',

    // Attachment actions
    ATTACHMENT_UPLOADED: 'attachment_uploaded',
    ATTACHMENT_DELETED: 'attachment_deleted',
    // Checklist actions
    CHECKLIST_ITEM_ADDED: 'checklist_item_added',
    CHECKLIST_ITEM_COMPLETED: 'checklist_item_completed',

    // Member actions
    MEMBER_INVITED: 'member_invited',
};

// Entity types
const ENTITY_TYPES = {
    WORKSPACE: 'workspace',
    BOARD: 'board',
    LIST: 'list',
    CARD: 'card',
    COMMENT: 'comment',
    ATTACHMENT: 'attachment',
};

// Xuất ra array cho Mongoose enum validation
const ACTIVITY_ACTION_VALUES = Object.values(ACTIVITY_ACTIONS);
const ENTITY_TYPE_VALUES = Object.values(ENTITY_TYPES);

module.exports = {
    ACTIVITY_ACTIONS,
    ENTITY_TYPES,
    ACTIVITY_ACTION_VALUES,
    ENTITY_TYPE_VALUES,
};
