/**
 * Constants for Permission Actions
 */
const PERMISSIONS = {
    WORKSPACE: {
        VIEW: 'workspace:view',
        EDIT: 'workspace:edit',
        DELETE: 'workspace:delete',
        INVITE: 'workspace:invite',
        MANAGE_MEMBERS: 'workspace:manage_members',
        MANAGE_ROLES: 'workspace:manage_roles',
        CREATE_BOARD: 'workspace:create_board'
    },
    BOARD: {
        VIEW: 'board:view',
        EDIT: 'board:edit',
        DELETE: 'board:delete',
        INVITE: 'board:invite',
        MANAGE_MEMBERS: 'board:manage_members',
        CREATE_LIST: 'board:create_list',
        MOVE_LIST: 'board:move_list',
        MANAGE_LISTS: 'board:manage_lists'
    },
    LIST: {
        CREATE: 'list:create',
        UPDATE: 'list:update',
        DELETE: 'list:delete',
        MOVE: 'list:move'
    },
    CARD: {
        VIEW: 'card:view',
        CREATE: 'card:create',
        UPDATE: 'card:update',
        DELETE: 'card:delete',
        MOVE: 'card:move',
        ASSIGN_MEMBER: 'card:assign_member',
        REMOVE_MEMBER: 'card:remove_member'
    },
    COMMENT: {
        CREATE: 'comment:create',
        UPDATE: 'comment:update',
        DELETE: 'comment:delete'
    },
    ATTACHMENT: {
        CREATE: 'attachment:create', // Upload
        DELETE: 'attachment:delete',
        UPDATE: 'attachment:update' // e.g., Rename
    }
};

module.exports = PERMISSIONS;
