const express = require("express");
const router = express.Router();

const WorkspaceController = require("../controllers/WorkspaceController");

const { requireWorkspaceMember, requireWorkspaceAdmin } = require('../middlewares/workspaceMiddleware');
const protect = require("../middlewares/authMiddleware");

// [PATCH] /api/workspaces/:workspaces/members/role
router.patch('/:workspaceId/members/role', protect, requireWorkspaceAdmin, WorkspaceController.updateMemberRole);

// [PATCH] /api/workspaces/:workspaces/permissions
router.patch('/:workspaceId/permissions', protect, requireWorkspaceAdmin, WorkspaceController.updatePermissions);

// [DELETE] /api/workspaces/:workspaceId/members
router.delete('/:workspaceId/members', protect, requireWorkspaceAdmin, WorkspaceController.kickMember);

// [GET] /api/workspaces/:workspaceId/members
router.get('/:workspaceId/members', protect, requireWorkspaceMember, WorkspaceController.getWorkspaceMembers);

// [POST] /api/workspaces/:workspaceId/members
router.post('/:workspaceId/invite', protect, requireWorkspaceMember, WorkspaceController.inviteMember);

// [PATCH] /api/workspaces/:workspaceId
router.patch('/:workspaceId', protect, requireWorkspaceAdmin, WorkspaceController.updateWorkspace);

// [POST] /api/workspaces/create
router.post("/create", protect, WorkspaceController.create);

// GET /api/workspaces
router.get("/", protect, WorkspaceController.getMyWorkspaces);

module.exports = router;
