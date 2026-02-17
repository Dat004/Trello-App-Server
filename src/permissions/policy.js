const PERMISSIONS = require('./definitions');
const mongoose = require('mongoose');

/**
 * Define abilities for a user based on context
 * @param {Object} user - The user object (can be null for guests)
 * @param {Object} context - { workspace, board, card, comment, attachment }
 * @returns {Array<String>} List of allowed actions
 */
const defineAbilitiesFor = (user, context = {}) => {
    const { workspace, board, comment, attachment } = context;
    const can = new Set();
    const userId = user ? user._id : null;

    // Helper: Check if user is a workspace member
    const isWsMember = (ws) => user && ws && ws.members && ws.members.some(m => m.user.equals(userId));

    // Helper: Check if user is a workspace admin/owner
    const isWsAdminOrOwner = (ws) => {
        if (!user || !ws) return false;
        if (ws.owner.equals(userId)) return true;
        const member = ws.members.find(m => m.user.equals(userId));
        return member && member.role === 'admin';
    };

    // Helper: Check if user is a board member
    const isBoardMember = (b) => user && b && b.members && b.members.some(m => m.user && m.user.equals(userId));

    // =========================================================================
    // 1. WORKSPACE LEVEL PERMISSIONS
    // =========================================================================
    if (workspace) {
        // --- VISIBILITY CHECK ---
        let canViewWorkspace = false;

        // 1. Public Workspace: Anyone can view (even guests)
        if (workspace.visibility === 'public') {
            canViewWorkspace = true;
        }
        // 2. Private: Only members
        else if (isWsMember(workspace)) {
            canViewWorkspace = true;
        }

        if (canViewWorkspace) {
            can.add(PERMISSIONS.WORKSPACE.VIEW);
        }

        // --- MEMBER ACTIONS ---
        if (user && isWsMember(workspace)) {
            // Basic member rights
            // Check permissions setting for Create Board
            // NEW DEFAULT: Only Admin/Owner can create boards (to prevent membership inflation)
            if (workspace.permissions && workspace.permissions.canCreateBoard === 'admin_member') {
                // If explicitly set to allow members
                can.add(PERMISSIONS.WORKSPACE.CREATE_BOARD);
            }

            // Check permissions setting for Invite
            if (!workspace.permissions || workspace.permissions.canInviteMember === 'any') {
                can.add(PERMISSIONS.WORKSPACE.INVITE);
            }

            // --- ADMIN / OWNER ---
            if (isWsAdminOrOwner(workspace)) {
                can.add(PERMISSIONS.WORKSPACE.EDIT);
                can.add(PERMISSIONS.WORKSPACE.MANAGE_MEMBERS);
                can.add(PERMISSIONS.WORKSPACE.MANAGE_ROLES);
                can.add(PERMISSIONS.WORKSPACE.CREATE_BOARD); // Admin override
                can.add(PERMISSIONS.WORKSPACE.INVITE);       // Admin override
            }

            // --- OWNER ONLY ---
            if (workspace.owner.equals(userId)) {
                can.add(PERMISSIONS.WORKSPACE.DELETE);
            }
        }
    }

    // =========================================================================
    // 2. BOARD LEVEL PERMISSIONS
    // =========================================================================
    if (board) {
        // --- VISIBILITY CHECK ---
        let canViewBoard = false;

        // 1. Public Board
        if (board.visibility === 'public') {
            canViewBoard = true;
        }
        // 2. Workspace Visibility (Members of the parent workspace)
        else if (board.visibility === 'workspace') {
            // Check if user is member of the workspace this board belongs to
            // Note: req.context.workspace might be populated, or we check board.workspace if populated
            // Rely on 'workspace' passed in context which is reliable via loadContext
            if (workspace && isWsMember(workspace)) {
                canViewBoard = true;
            }
        }
        // 3. Private Board (Only Board Members)
        else { // private
            if (isBoardMember(board)) {
                canViewBoard = true;
            }
            // Edge case: Workspace Admin/Owner can typically see private boards in their workspace?
            // Policies vary. Trello admins can see/close private boards.
            if (workspace && isWsAdminOrOwner(workspace)) {
                canViewBoard = true;
            }
        }

        if (canViewBoard) {
            can.add(PERMISSIONS.BOARD.VIEW);
            can.add(PERMISSIONS.CARD.VIEW);
        }

        // --- INTERACTION PERMISSIONS (Authenticated Only) ---
        if (user && canViewBoard) {

            // Determine "Effective Admin" for Board
            let isEffectiveAdmin = false;

            // 1. Board Admin
            const bMember = board.members.find(m => m.user && m.user.equals(userId));
            if (bMember && bMember.role === 'admin') isEffectiveAdmin = true;

            // 2. Board Owner (if distinct field exists, schema says 'owner')
            if (board.owner && board.owner.equals(userId)) isEffectiveAdmin = true;

            // 3. Workspace Admin/Owner (Inheritance)
            if (workspace && isWsAdminOrOwner(workspace)) isEffectiveAdmin = true;

            // --- REGULAR MEMBERS ---
            // Must be an explicit board member OR effective admin to edit content
            // (Workspace members can VIEW 'workspace' visible boards, but must JOIN to edit? 
            //  Trello logic: You must join to edit. But for simplicity, we might allow WS members to edit 'workspace' boards directly?
            //  Let's stick to: "If you are a Board Member or Admin")

            const isMemberOrAdmin = (bMember || isEffectiveAdmin);

            if (isMemberOrAdmin) {
                // LIST
                can.add(PERMISSIONS.BOARD.CREATE_LIST);
                can.add(PERMISSIONS.BOARD.MANAGE_LISTS);
                can.add(PERMISSIONS.LIST.CREATE);
                can.add(PERMISSIONS.LIST.UPDATE);
                can.add(PERMISSIONS.LIST.MOVE);
                can.add(PERMISSIONS.LIST.DELETE);

                // CARD
                can.add(PERMISSIONS.CARD.CREATE);
                can.add(PERMISSIONS.CARD.UPDATE);
                can.add(PERMISSIONS.CARD.MOVE);
                can.add(PERMISSIONS.CARD.DELETE);

                // COMMENT
                can.add(PERMISSIONS.COMMENT.CREATE);

                // ATTACHMENT
                can.add(PERMISSIONS.ATTACHMENT.CREATE);
            }

            // --- ADMIN ONLY ---
            if (isEffectiveAdmin) {
                can.add(PERMISSIONS.BOARD.EDIT);
                can.add(PERMISSIONS.BOARD.DELETE);
                can.add(PERMISSIONS.BOARD.INVITE);
                can.add(PERMISSIONS.BOARD.MANAGE_MEMBERS);
                can.add(PERMISSIONS.CARD.ASSIGN_MEMBER);
                can.add(PERMISSIONS.CARD.REMOVE_MEMBER);
                can.add(PERMISSIONS.COMMENT.DELETE);
                can.add(PERMISSIONS.ATTACHMENT.DELETE);
                can.add(PERMISSIONS.ATTACHMENT.UPDATE);
            }

            // =========================================================================
            // 3. RESOURCE OWNERSHIP
            // =========================================================================
            if (comment && comment.author && comment.author.equals(userId)) {
                can.add(PERMISSIONS.COMMENT.UPDATE);
                can.add(PERMISSIONS.COMMENT.DELETE);
            }
            // (Similar logic for Attachments if needed)
        }
    }

    return Array.from(can);
};

module.exports = { defineAbilitiesFor };
