const Workspace = require("../../models/Workspace.model");
const Board = require("../../models/Board.model");
const User = require("../../models/User.model");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../../constants/activities");

const withTransaction = require('../common/withTransaction');
const {
    logMemberRoleChanged,
    logMemberRemoved,
    logJoinRequestApproved,
    logJoinRequestRejected
} = require("../activity/log");
const { generateNotificationsForActivity } = require("../notification/create");

// Invite a user to the workspace
const inviteMember = async (workspace, user, email, role) => {
    // Kiểm tra user có tồn tại không
    const invitedUser = await User.findOne({ email });
    if (!invitedUser) {
        throw new Error("Email này chưa được đăng ký. Không thể gửi lời mời.");
    }

    // Kiểm tra user đã là thành viên hoặc đã được mời chưa
    const existingMember = workspace.members.find(
        (m) => m.user.toString() === invitedUser._id.toString()
    );
    const existingInvite = workspace.invites.find(
        (i) => i.email === email && i.status === "pending"
    );

    if (existingMember || existingInvite) {
        throw new Error("Người dùng này đã tham gia hoặc đã được mời");
    }

    // Kiểm tra giới hạn thành viên
    const pendingCount = workspace.invites.filter((i) => i.status === "pending").length;
    if (workspace.members.length + pendingCount >= workspace.max_members) {
        throw new Error("Workspace đã đạt giới hạn thành viên");
    }

    // Thêm lời mời
    workspace.invites.push({
        email,
        role,
        invited_by: user._id,
    });

    await workspace.save();
    await workspace.populate('members.user', 'full_name email avatar');

    // Gửi thông báo
    generateNotificationsForActivity({
        action: ACTIVITY_ACTIONS.MEMBER_INVITED,
        entity_type: ENTITY_TYPES.WORKSPACE,
        entity_id: workspace._id,
        workspace: workspace._id,
        board: null,
        actor: { _id: user._id },
        metadata: {
            member_id: invitedUser._id,
            workspace_title: workspace.title
        }
    }).catch(err => console.error('[Notification] Failed to send invite notify:', err));

    return workspace;
};

// Remove member from workspace (Kick)
const kickMember = async (workspace, actor, memberId) => {
    if (workspace.owner.equals(memberId)) {
        throw new Error("Không thể xóa owner khỏi workspace");
    }

    // Kiểm tra thành viên có tồn tại không
    const memberIndex = workspace.members.findIndex(m => m.user.equals(memberId));
    if (memberIndex === -1) throw new Error("Thành viên không tồn tại trong workspace");

    const targetMember = workspace.members[memberIndex];

    // Kiểm tra quyền hạn (Admin không thể xóa admin, trừ khi là owner)
    const isTargetAdmin = targetMember.role === "admin";
    const isActorOwner = workspace.owner.equals(actor._id);

    if (isTargetAdmin && !isActorOwner) {
        throw new Error("Chỉ owner mới có thể xóa admin khỏi workspace");
    }

    // Wrap trong transaction để đảm bảo data consistency
    const result = await withTransaction(async (session) => {
        // CASCADE: Xóa khỏi tất cả board trong workspace này (BULK OPERATION)
        const bulkResult = await Board.updateMany(
            {
                workspace: workspace._id,
                deleted_at: null,
                'members.user': memberId  // Only update boards where user is actually a member
            },
            {
                $pull: { members: { user: memberId } }
            },
            { session }  // Use transaction session
        );

        const boardsAffected = bulkResult.modifiedCount;

        // Thực hiện xóa khỏi workspace
        await Workspace.updateOne(
            { _id: workspace._id },
            { $pull: { members: { user: memberId } } },
            { session }
        );

        return { boardsAffected };
    });

    console.log(`[kickMember] Removed user from ${result.boardsAffected} boards in workspace`);

    // Ghi log
    const memberUser = await User.findById(memberId);
    if (memberUser) {
        logMemberRemoved({
            entityType: 'workspace',
            entityId: workspace._id,
            workspace: workspace._id,
            board: null,
            member: memberUser,
            actor: actor._id
        });
    }

    return memberId;
};

// Update member role
const updateMemberRole = async (workspace, actor, memberId, newRole) => {
    if (workspace.owner.equals(memberId)) {
        throw new Error("Không thể thay đổi role của owner workspace.");
    }

    const targetMember = workspace.members.find(m => m.user.equals(memberId));
    if (!targetMember) throw new Error("Thành viên không tồn tại");

    const isTargetAdmin = targetMember.role === "admin";
    const isActorOwner = workspace.owner.equals(actor._id);

    if (isTargetAdmin && !isActorOwner) {
        throw new Error("Chỉ owner mới có thể thay đổi role của admin khác.");
    }

    const oldRole = targetMember.role;

    // Update
    await Workspace.updateOne(
        { _id: workspace._id, deleted_at: null, "members.user": memberId },
        { $set: { "members.$.role": newRole } }
    );

    // Log & Notify
    const memberUser = await User.findById(memberId);
    if (memberUser) {
        logMemberRoleChanged({
            entityType: 'workspace',
            entityId: workspace._id,
            workspace: workspace._id,
            board: null,
            member: memberUser,
            oldRole,
            newRole,
            actor: actor._id
        });
    }

    return { memberId, newRole };
};

// Approve join request
const approveJoinRequest = async (workspace, actor, requestId) => {
    // Kiểm tra yêu cầu có tồn tại không
    const request = workspace.join_requests.id(requestId);
    if (!request) throw new Error("Yêu cầu không tồn tại hoặc đã được xử lý");

    const targetUserId = request.user;

    // Kiểm tra người dùng đã là thành viên chưa
    const isAlreadyMember = workspace.members.some(m => m.user.equals(targetUserId));
    if (isAlreadyMember) {
        workspace.join_requests.pull(requestId);
        await workspace.save();
        throw new Error("Người dùng này đã là thành viên của workspace");
    }

    // Kiểm tra giới hạn thành viên
    if (workspace.members.length >= workspace.max_members) {
        throw new Error("Workspace đã đạt giới hạn thành viên");
    }

    // Thêm thành viên
    const newMember = {
        user: targetUserId,
        role: "member",
        joinedAt: new Date(),
    };
    workspace.members.push(newMember);

    // Xóa lời mời nếu có
    const targetUser = await User.findById(targetUserId);
    if (targetUser) {
        workspace.invites = workspace.invites.filter(i => i.email !== targetUser.email);
    }

    // Xóa yêu cầu
    workspace.join_requests.pull(requestId);

    await workspace.save();

    // Populate để trả về FE đầy đủ thông tin
    await workspace.populate({
        path: 'members.user',
        select: '_id full_name email avatar.url'
    });

    // Lấy thành viên vừa được thêm
    const addedMember = workspace.members.find(m => m.user._id.equals(targetUserId));

    // Ghi log
    logJoinRequestApproved(workspace, actor._id, targetUser);

    return {
        member: addedMember,
        targetUser: addedMember.user,
    };
};

// Reject join request
const rejectJoinRequest = async (workspace, actor, requestId) => {
    const request = workspace.join_requests.id(requestId);
    if (!request) throw new Error("Yêu cầu không tồn tại hoặc đã được xử lý");

    const targetUserId = request.user;
    const targetUser = await User.findById(targetUserId);

    workspace.join_requests.pull(requestId);
    await workspace.save();

    // Ghi log
    logJoinRequestRejected(workspace, actor._id, targetUser);

    return { targetUser };
};

module.exports = {
    inviteMember,
    kickMember,
    updateMemberRole,
    approveJoinRequest,
    rejectJoinRequest
};
