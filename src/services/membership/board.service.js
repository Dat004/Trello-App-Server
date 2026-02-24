const User = require("../../models/User.model");
const Workspace = require("../../models/Workspace.model");
const Board = require("../../models/Board.model");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../../constants/activities");

const { emitToRoom } = require("../../utils/socketHelper");
const {
    logMemberAdded,
    logMemberRemoved,
    logJoinRequestRejected,
    logJoinRequestApproved,
    logBoardJoinRequestApproved,
    logBoardJoinRequestRejected,
    logMemberRoleChanged
} = require("../activity/log");
const { generateNotificationsForActivity } = require("../notification/create");


// Invite a user to the board
const inviteMember = async (board, user, email, role) => {
    // Kiểm tra user có tồn tại không
    const invitedUser = await User.findOne({ email });
    if (!invitedUser) {
        throw new Error("Email này chưa được đăng ký tài khoản. Không thể mời.");
    }

    // WORKSPACE CONSTRAINT: If board belongs to workspace, invited user must be workspace member
    if (board.workspace) {
        const workspace = await Workspace.findById(board.workspace);

        if (!workspace) {
            throw new Error("Workspace không tồn tại.");
        }

        const isWsMember = workspace.members.some(m => m.user.equals(invitedUser._id));
        if (!isWsMember) {
            throw new Error("Người dùng phải là thành viên Workspace trước khi tham gia Board");
        }
    }

    // Kiểm tra trùng lặp (trong members)
    const existingMember = board.members.find(
        (m) => m.user.equals(invitedUser._id)
    );
    if (existingMember) {
        throw new Error("Người dùng này đã là thành viên board");
    }

    // Kiểm tra trùng lặp (trong pending invites)
    if (board.invites) {
        const existingInvite = board.invites.find(
            (i) => i.email === email && i.status === "pending"
        );
        if (existingInvite) {
            throw new Error("Người dùng này đã được mời vào board");
        }
    } else {
        board.invites = [];
    }

    board.invites.push({
        email,
        role,
        invited_by: user._id,
        status: "pending"
    });

    await board.save();

    // Populate members to ensure FE has full user details
    await board.populate("members.user", "full_name email avatar");

    // Gửi thông báo
    generateNotificationsForActivity({
        action: ACTIVITY_ACTIONS.MEMBER_INVITED,
        entity_type: ENTITY_TYPES.BOARD,
        entity_id: board._id,
        workspace: board.workspace || null,
        board: board._id,
        actor: { _id: user._id },
        metadata: {
            member_id: invitedUser._id,
            board_title: board.title
        }
    }).catch(err => console.error('[Notification] Failed to send board invite notify:', err));

    return { board, invitedUser };
};

// Remove member from board (Kick)
const kickMember = async (board, actor, member_id) => {
    if (board.owner.equals(member_id)) {
        throw new Error("Không thể kick owner khỏi board");
    }

    // Kiểm tra thành viên có tồn tại không
    const memberIndex = board.members.findIndex(
        (m) => m.user.equals(member_id)
    );

    if (memberIndex === -1) {
        throw new Error("Thành viên không tồn tại trong board");
    }

    // Kiểm tra quyền hạn
    const targetMember = board.members[memberIndex];
    const isTargetAdmin = targetMember.role === "admin";
    const isActorOwner = board.owner.equals(actor._id);

    if (isTargetAdmin && !isActorOwner) {
        throw new Error("Chỉ owner mới có thể xóa admin khỏi board");
    }

    // Xóa thành viên
    board.members.splice(memberIndex, 1);
    await board.save();

    // Ghi log và thông báo
    const memberUser = await User.findById(member_id);
    if (memberUser) {
        logMemberRemoved({
            entityType: 'board',
            entityId: board._id,
            workspace: board.workspace || null,
            board: board._id,
            member: memberUser,
            actor: actor._id
        });
    }

    emitToRoom({
        room: `board:${board._id}`,
        event: "board-member-removed",
        data: { boardId: board._id, userId: actor._id },
        socketId: null
    });

    return member_id;
};

// Approve join request
const approveJoinRequest = async (board, actor, requestId) => {
    // Kiểm tra yêu cầu có tồn tại không
    const request = board.join_requests.id(requestId);
    if (!request) throw new Error("Yêu cầu không tồn tại hoặc đã được xử lý");

    const targetUserId = request.user;

    // Kiểm tra người dùng đã là thành viên chưa
    const isAlreadyMember = board.members.some(m => m.user.equals(targetUserId));
    if (isAlreadyMember) {
        board.join_requests.pull(requestId);
        await board.save();
        throw new Error("Người dùng này đã là thành viên của board");
    }

    // WORKSPACE CONSTRAINT: If board belongs to workspace, user must be workspace member
    if (board.workspace) {
        const workspace = await Workspace.findById(board.workspace);
        if (!workspace) {
            throw new Error("Workspace không tồn tại.");
        }

        const isWsMember = workspace.members.some(m => m.user.equals(targetUserId));
        if (!isWsMember) {
            throw new Error("Người dùng phải là thành viên Workspace trước khi tham gia Board");
        }
    }

    // Thêm thành viên
    const newMember = {
        user: targetUserId,
        role: "member",
        joinedAt: new Date(),
    };
    board.members.push(newMember);

    // Xóa lời mời nếu có
    const targetUser = await User.findById(targetUserId);
    if (targetUser) {
        board.invites = board.invites.filter(i => i.email !== targetUser.email);
    }

    // Xóa yêu cầu
    board.join_requests.pull(requestId);

    await board.save();

    // Populate để trả về FE đầy đủ thông tin
    await board.populate({
        path: 'members.user',
        select: '_id full_name email avatar.url'
    });

    // Lấy thành viên vừa được thêm
    const addedMember = board.members.find(m => m.user._id.equals(targetUserId));

    // Ghi log
    logBoardJoinRequestApproved(board, actor._id, targetUser);

    // Socket broadcast
    emitToRoom({
        room: `board:${board._id}`,
        event: "member-joined",
        data: addedMember,
        socketId: null
    });

    return {
        member: addedMember,
        targetUser: addedMember.user,
    };
};

// Reject join request
const rejectJoinRequest = async (board, actor, requestId) => {
    const request = board.join_requests.id(requestId);
    if (!request) throw new Error("Yêu cầu không tồn tại hoặc đã được xử lý");

    const targetUserId = request.user;
    const targetUser = await User.findById(targetUserId);

    board.join_requests.pull(requestId);
    await board.save();

    // Ghi log
    logBoardJoinRequestRejected(board, actor._id, targetUser);

    return { targetUser };
};

// Update member role
const updateMemberRole = async (board, actor, memberId, newRole) => {
    if (board.owner.equals(memberId)) {
        throw new Error("Không thể thay đổi role của owner board.");
    }

    const targetMember = board.members.find(m => m.user.equals(memberId));
    if (!targetMember) throw new Error("Thành viên không tồn tại");

    const isTargetAdmin = targetMember.role === "admin";
    const isActorOwner = board.owner.equals(actor._id);

    if (isTargetAdmin && !isActorOwner) {
        throw new Error("Chỉ owner mới có thể thay đổi role của admin khác.");
    }

    const oldRole = targetMember.role;

    // Update
    await Board.updateOne(
        { _id: board._id, deleted_at: null, "members.user": memberId },
        { $set: { "members.$.role": newRole } }
    );

    // Log & Notify
    const memberUser = await User.findById(memberId);
    if (memberUser) {
        logMemberRoleChanged({
            entityType: 'board',
            entityId: board._id,
            workspace: board.workspace || null,
            board: board._id,
            member: memberUser,
            oldRole,
            newRole,
            actor: actor._id
        });
    }

    emitToRoom({
        room: `board:${board._id}`,
        event: "member-role-updated",
        data: { member_id: memberId, role: newRole },
        socketId: null
    });

    return { memberId, newRole };
};

module.exports = {
    inviteMember,
    kickMember,
    updateMemberRole,
    approveJoinRequest,
    rejectJoinRequest
};
