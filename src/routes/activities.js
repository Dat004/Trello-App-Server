const express = require('express');
const router = express.Router();

const ActivityController = require('../controllers/ActivityController');
const protect = require('../middlewares/authMiddleware');
const loadContext = require('../middlewares/contextMiddleware');
const authorize = require('../middlewares/permissionMiddleware');
const PERMISSIONS = require('../permissions/definitions');

// GET /api/activities/me
router.get('/me', protect, ActivityController.getMyActivities);

// GET /api/activities/workspace/:workspaceId
router.get('/workspace/:workspaceId',
    protect,
    loadContext,
    authorize(PERMISSIONS.WORKSPACE.VIEW),
    ActivityController.getWorkspaceActivities
);

// GET /api/activities/board/:boardId
router.get('/board/:boardId',
    protect,
    loadContext,
    authorize(PERMISSIONS.BOARD.VIEW),
    ActivityController.getBoardActivities
);

module.exports = router;
