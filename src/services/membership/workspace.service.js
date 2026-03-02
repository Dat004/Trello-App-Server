const Workspace = require("../../models/Workspace.model");
const Board = require("../../models/Board.model");
const User = require("../../models/User.model");
const Notification = require("../../models/Notification.model");
const withTransaction = require("../common/withTransaction");
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require("../../constants/activities");
const { emitToRoom } = require("../../utils/socketHelper");

const {
    logActivity,
    logMemberAdded,
    logMemberRoleChanged,
    logMemberRemoved,
    logJoinRequestApproved,
    logJoinRequestRejected
} = require("../activity/log");
const { generateNotificationsForActivity } = require("../notification/create");


// Invite multiple users to the workspace
const inviteMembers = async (workspace, user, emails, role, message = "") => {
    const results = {
        invited: [],
        failed: [],
    };

    // Kiểm tra giới hạn thành viên
    const pendingCount = workspace.invites.filter((i) => i.status === "pending").length;
    if (workspace.members.length + pendingCount + emails.length > workspace.max_members) {
        throw new Error("Số lượng email mời vượt quá giới hạn thành viên của Workspace");
    }

    for (const email of emails) {
        try {
            // Kiểm tra user có tồn tại không
            const invitedUser = await User.findOne({ email });
            if (!invitedUser) {
                results.failed.push({ email, reason: "Email này chưa được đăng ký tài khoản." });
                continue;
            }

            // Kiểm tra user đã là thành viên hoặc đã được mời chưa
            const existingMember = workspace.members.find(
                (m) => m.user.toString() === invitedUser._id.toString()
            );
            const existingInvite = workspace.invites.find(
                (i) => i.email === email && i.status === "pending"
            );

            if (existingMember || existingInvite) {
                results.failed.push({ email, reason: "Người dùng này đã tham gia hoặc đã được mời." });
                continue;
            }

            // Thêm lời mời
            workspace.invites.push({
                email,
                role,
                message,
                invited_by: user._id,
            });

            results.invited.push({ email, user: invitedUser });
        } catch (error) {
            results.failed.push({ email, reason: error.message });
        }
    }

    await workspace.save();
    await workspace.populate('members.user', 'full_name email avatar');

    // Ghi activity - 1 lần duy nhất (activity feed)
    // Không truyền member_id vào log vì đây là batch invite
    if (results.invited.length > 0) {
        logActivity({
            action: ACTIVITY_ACTIONS.MEMBER_INVITED,
            entityType: ENTITY_TYPES.WORKSPACE,
            entityId: workspace._id,
            workspace: workspace._id,
            board: null,
            actor: user._id,
            metadata: {
                invited_count: results.invited.length,
                role,
                message
            }
        });
    }

    // Gửi notification riêng cho từng người được mời
    for (const item of results.invited) {
        generateNotificationsForActivity({
            action: ACTIVITY_ACTIONS.MEMBER_INVITED,
            entity_type: ENTITY_TYPES.WORKSPACE,
            entity_id: workspace._id,
            workspace: workspace._id,
            board: null,
            actor: { _id: user._id },
            metadata: {
                member_id: item.user._id,
                workspace_title: workspace.name || workspace.title,
                message
            }
        }).catch(err => console.error('[Notification] workspace invite failed:', err));
    }

    return { workspace, results };
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

// Accept or Reject invite
const respondToInvite = async (workspace, user, action, notificationId) => {
    // Tìm lời mời dựa theo email người đang đăng nhập
    const invite = workspace.invites.find(
        i => i.email === user.email && i.status === "pending"
    );

    if (!invite) throw new Error("Lời mời không tồn tại hoặc đã hết hiệu lực");

    if (action === "accept") {
        // Kiểm tra đã là thành viên chưa
        const isAlreadyMember = workspace.members.some(m => m.user.equals(user._id));
        if (isAlreadyMember) {
            workspace.invites = workspace.invites.filter(i => i.email !== user.email);
            await workspace.save();
            throw new Error("Bạn đã là thành viên của workspace này");
        }

        // Kiểm tra giới hạn thành viên
        if (workspace.members.length >= workspace.max_members) {
            throw new Error("Workspace đã đạt giới hạn thành viên");
        }

        // Thêm vào danh sách thành viên
        workspace.members.push({
            user: user._id,
            role: invite.role || "member",
            joinedAt: new Date()
        });
    }

    // Xóa lời mời (cả accept lẫn reject)
    workspace.invites = workspace.invites.filter(i => i.email !== user.email);
    await workspace.save();

    // Xóa notification lời mời khỏi DB bằng ID cụ thể
    if (notificationId) {
        await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: user._id // Bảo vệ: chỉ xóa được notification của chính mình
        });
    }

    // Gửi thông báo đến người đã mời
    if (invite.invited_by) {
        generateNotificationsForActivity({
            action: action === "accept" ? ACTIVITY_ACTIONS.INVITE_ACCEPTED : ACTIVITY_ACTIONS.INVITE_REJECTED,
            entity_type: ENTITY_TYPES.WORKSPACE,
            entity_id: workspace._id,
            workspace: workspace._id,
            board: null,
            actor: { _id: user._id },
            metadata: {
                invited_by: invite.invited_by
            }
        }).catch(err => console.error('[Notification] respond to invite failed:', err));
    }

    if (action === "accept") {
        await workspace.populate({
            path: 'members.user',
            select: '_id full_name email avatar.url'
        });
        const addedMember = workspace.members.find(m => m.user._id.equals(user._id));

        // Ghi activity
        logMemberAdded({
            entityType: ENTITY_TYPES.WORKSPACE,
            entityId: workspace._id,
            workspace: workspace._id,
            board: null,
            member: user,
            role: invite.role || "member",
            actor: user._id
        });

        emitToRoom({
            room: `workspace:${workspace._id}`,
            event: "member-joined",
            data: addedMember,
            socketId: null
        });

        return { action: "accepted", member: addedMember };
    }

    return { action: "rejected" };
};

module.exports = {
    inviteMembers,
    respondToInvite,
    kickMember,
    updateMemberRole,
    approveJoinRequest,
    rejectJoinRequest
};
