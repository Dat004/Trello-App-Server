const PERMISSIONS = require('./definitions');

const defineAbilitiesFor = (user, context = {}) => {
    const { workspace, board, comment, attachment } = context;
    const can = new Set();
    const userId = user ? user._id : null;

    // Kiểm tra quyền thành viên workspace
    const isWsMember = (ws) => user && ws && ws.members && ws.members.some(m => m.user.equals(userId));
    const isWsAdminOrOwner = (ws) => {
        if (!user || !ws) return false;
        if (ws.owner.equals(userId)) return true;
        const member = ws.members.find(m => m.user.equals(userId));
        return member && member.role === 'admin';
    };

    // Kiểm tra quyền thành viên board
    const isBoardMember = (b) => user && b && b.members && b.members.some(m => m.user && m.user.equals(userId));

    // 1. WORKSPACE LEVEL PERMISSIONS
    if (workspace) {
        // --- VISIBILITY CHECK ---
        let canViewWorkspace = false;

        // 1. Public Workspace: Ai cũng có thể xem (kể cả khách)
        if (workspace.visibility === 'public') {
            canViewWorkspace = true;
        }
        // 2. Private: Chỉ thành viên
        else if (isWsMember(workspace)) {
            canViewWorkspace = true;
        }

        if (canViewWorkspace) {
            can.add(PERMISSIONS.WORKSPACE.VIEW);
        }

        // --- MEMBER ACTIONS ---
        if (user && isWsMember(workspace)) {
            // Kiểm tra quyền tạo board
            if (workspace.permissions && workspace.permissions.canCreateBoard === 'admin_member') {
                can.add(PERMISSIONS.WORKSPACE.CREATE_BOARD);
            }

            // Kiểm tra quyền mời thành viên
            if (!workspace.permissions || workspace.permissions.canInviteMember === 'any') {
                can.add(PERMISSIONS.WORKSPACE.INVITE);
            }

            // --- ADMIN / OWNER ---
            if (isWsAdminOrOwner(workspace)) {
                can.add(PERMISSIONS.WORKSPACE.EDIT);
                can.add(PERMISSIONS.WORKSPACE.MANAGE_MEMBERS);
                can.add(PERMISSIONS.WORKSPACE.MANAGE_ROLES);
                can.add(PERMISSIONS.WORKSPACE.CREATE_BOARD);
                can.add(PERMISSIONS.WORKSPACE.INVITE);
            }

            // --- OWNER ONLY ---
            if (workspace.owner.equals(userId)) {
                can.add(PERMISSIONS.WORKSPACE.DELETE);
            }
        }
    }

    // 2. BOARD LEVEL PERMISSIONS
    if (board) {
        // --- VISIBILITY CHECK ---
        let canViewBoard = false;

        // 1. Public Board
        if (board.visibility === 'public') {
            canViewBoard = true;
        }
        // 2. Workspace Visibility (Thành viên của workspace)
        else if (board.visibility === 'workspace') {
            // Kiểm tra xem user có phải là thành viên của workspace này không
            if (workspace && isWsMember(workspace)) {
                canViewBoard = true;
            }
        }
        // 3. Private Board (Chỉ thành viên)
        else { // private
            if (isBoardMember(board)) {
                canViewBoard = true;
            }
            // Workspace Admin/Owner có thể xem private board trong workspace của họ
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

            // Xác định "Effective Admin" cho Board
            let isEffectiveAdmin = false;

            // 1. Board Admin
            const bMember = board.members.find(m => m.user && m.user.equals(userId));
            if (bMember && bMember.role === 'admin') isEffectiveAdmin = true;

            // 2. Board Owner (if distinct field exists, schema says 'owner')
            if (board.owner && board.owner.equals(userId)) isEffectiveAdmin = true;

            // 3. Workspace Admin/Owner (Inheritance)
            if (workspace && isWsAdminOrOwner(workspace)) isEffectiveAdmin = true;

            // Kiểm tra quyền thành viên hoặc admin
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

            // 3. RESOURCE OWNERSHIP
            if (comment && comment.author && comment.author.equals(userId)) {
                can.add(PERMISSIONS.COMMENT.UPDATE);
                can.add(PERMISSIONS.COMMENT.DELETE);
            }
        }
    }

    return Array.from(can);
};

module.exports = { defineAbilitiesFor };
