const express = require("express");
const router = express.Router();

const WorkspaceController = require("../controllers/WorkspaceController");
const PERMISSIONS = require("../permissions/definitions");

const protect = require("../middlewares/authMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const authorize = require("../middlewares/permissionMiddleware");

// [PATCH] /api/workspaces/:workspaces/members/role
router.patch('/:workspaceId/members/role',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.MANAGE_ROLES),
    WorkspaceController.updateMemberRole
);

// [PATCH] /api/workspaces/:workspaces/permissions
router.patch('/:workspaceId/permissions',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.EDIT),
    WorkspaceController.updatePermissions
);

// [DELETE] /api/workspaces/:workspaces/members
router.delete('/:workspaceId/members',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.MANAGE_MEMBERS),
    WorkspaceController.kickMember
);

// [GET] /api/workspaces/:workspaces/members
router.get('/:workspaceId/members',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.VIEW),
    WorkspaceController.getWorkspaceMembers
);

// [POST] /api/workspaces/:workspaces/invite
router.post('/:workspaceId/invite',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.INVITE),
    WorkspaceController.inviteMember
);

// [PATCH] /api/workspaces/:workspaces/join/:requestId
router.patch('/:workspaceId/join/:requestId',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.MANAGE_MEMBERS),
    WorkspaceController.handleJoinRequest
);

// [POST] /api/workspaces/:workspaces/join
router.post('/:workspaceId/join', protect, WorkspaceController.sendJoinRequest);

// [GET] /api/workspaces/:workspaces/join
router.get('/:workspaceId/join',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.MANAGE_MEMBERS),
    WorkspaceController.getJoinRequests
);

// [DELETE] /api/workspaces/:workspaces
router.delete('/:workspaceId',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.DELETE),
    WorkspaceController.delete
);

// [PATCH] /api/workspaces/:workspaces
router.patch('/:workspaceId',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.EDIT),
    WorkspaceController.updateWorkspace
);

// [POST] /api/workspaces/:workspaces/boards
router.post("/:workspaceId/boards",
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.EDIT), // or MANAGE_BOARDS if strictly defined
    WorkspaceController.addBoardsToWorkspace
);

// [DELETE] /api/workspaces/:workspaces/boards
router.delete("/:workspaceId/boards",
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.EDIT),
    WorkspaceController.removeBoardsFromWorkspace
);

// [POST] /api/workspaces/create
router.post("/create", protect, WorkspaceController.create);

// [GET] /api/workspaces/:workspaceId
router.get("/:workspaceId",
    protect,
    loadContext,
    WorkspaceController.getWorkspaceById
);

// [GET] /api/workspaces
router.get("/", protect, WorkspaceController.getMyWorkspaces);

module.exports = router;
