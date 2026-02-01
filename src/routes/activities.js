const express = require('express');
const router = express.Router();

const ActivityController = require('../controllers/ActivityController');
const protect = require('../middlewares/authMiddleware');
const { requireWorkspaceMember } = require('../middlewares/workspaceMiddleware');
const { requireBoardAccess } = require('../middlewares/boardMiddleware');

// GET /api/activities/me
router.get('/me', protect, ActivityController.getMyActivities);

// GET /api/activities/workspace/:workspaceId
router.get('/workspace/:workspaceId', protect, requireWorkspaceMember, ActivityController.getWorkspaceActivities);

// GET /api/activities/board/:boardId
router.get('/board/:boardId', protect, requireBoardAccess, ActivityController.getBoardActivities);

module.exports = router;
