const express = require("express");
const router = express.Router();

const WorkspaceController = require("../controllers/WorkspaceController");

const { requireWorkspaceMember, requireWorkspaceAdmin } = require('../middlewares/workspaceMiddleware');
const protect = require("../middlewares/authMiddleware");

// [GET] /api/workspaces/:workspaceId/members
router.get('/:workspaceId/members', protect, requireWorkspaceMember, WorkspaceController.getWorkspaceMembers);

// [PATCH] /api/workspaces/:workspaceId
router.patch('/:workspaceId', protect, requireWorkspaceAdmin, WorkspaceController.updateWorkspace);

// [POST] /api/workspaces/create
router.post("/create", protect, WorkspaceController.create);

// GET /api/workspaces
router.get("/", protect, WorkspaceController.getMyWorkspaces);

module.exports = router;
