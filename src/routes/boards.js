const express = require("express");
const router = express.Router();

const BoardController = require("../controllers/BoardController");
const PERMISSIONS = require("../permissions/definitions");

const protect = require("../middlewares/authMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const authorize = require("../middlewares/permissionMiddleware");

// [PATCH] /api/boards/:boardId/members/role
router.patch('/:boardId/members/role',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.MANAGE_MEMBERS),
  BoardController.updateMemberRole
);

// [DELETE] /api/boards/:boardId/members
router.delete('/:boardId/members',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.MANAGE_MEMBERS),
  BoardController.kickMemberFromBoard
);

// [POST] /api/boards/:boardId/invite
router.post('/:boardId/invite',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.INVITE),
  BoardController.inviteMemberToBoard
);

// [PATCH] /api/boards/:boardId/join/:requestId
router.patch('/:boardId/join/:requestId',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.MANAGE_MEMBERS),
  BoardController.handleJoinRequest
);

// [POST] /api/boards/:boardId/join
router.post('/:boardId/join', protect, BoardController.sendJoinRequest);

// [GET] /api/boards/:boardId/join
router.get('/:boardId/join',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.MANAGE_MEMBERS),
  BoardController.getJoinRequests
);

// [DELETE] /api/boards/:boardId
router.delete("/:boardId",
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.DELETE),
  BoardController.destroy
);

// [PATCH] /api/boards/:boardId/archive
router.patch('/:boardId/archive',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.EDIT),
  BoardController.archiveBoard
);

// [PATCH] /api/boards/:boardId/unarchive
router.patch('/:boardId/unarchive',
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.EDIT),
  BoardController.unarchiveBoard
);

// [PATCH] /api/boards/:boardId
router.patch("/:boardId",
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.EDIT),
  BoardController.updateBoard
);

// [POST] /api/boards/create
router.post("/create", protect, BoardController.create);

// [GET] /api/boards/workspace/:workspaceId
router.get("/workspace/:workspaceId",
  protect,
  loadContext,
  authorize(PERMISSIONS.WORKSPACE.VIEW),
  BoardController.getBoardsByWorkspace
);

// [GET] /api/boards/:boardId
router.get("/:boardId",
  protect,
  loadContext,
  BoardController.getBoardById
);

// [GET] /api/boards (My Boards)
router.get("/", protect, BoardController.getMyBoards);

module.exports = router;
