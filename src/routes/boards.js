const express = require("express");
const router = express.Router();

const { requireWorkspaceMember } = require("../middlewares/workspaceMiddleware");
const BoardController = require("../controllers/BoardController");
const protect = require("../middlewares/authMiddleware");
const {
  requireBoardAccess,
  requireBoardAdmin,
  requireOwnerBoard,
} = require("../middlewares/boardMiddleware");

// [POST] /api/boards/:boardId/invite
router.post('/:boardId/invite', protect, requireBoardAccess, requireBoardAdmin, BoardController.inviteMemberToBoard);

// [DELETE] /api/boards/:boardId/members
router.delete('/:boardId/members', protect, requireBoardAccess, requireBoardAdmin, BoardController.kickMemberFromBoard);

// [DELETE] /api/boards/:boardId
router.delete("/:boardId", protect, requireBoardAccess, requireOwnerBoard, BoardController.destroy);

// [PATCH] /api/boards/:boardId/archive
router.patch('/:boardId/archive', protect, requireBoardAccess, requireBoardAdmin, BoardController.archiveBoard);

// [PATCH] /api/boards/:boardId/unarchive
router.patch('/:boardId/unarchive', protect, requireBoardAccess, requireBoardAdmin, BoardController.unarchiveBoard);

// [PATCH] /api/boards/:boardId
router.patch("/:boardId", protect, requireBoardAccess, requireBoardAdmin, BoardController.updateBoard);

// [POST] /api/boards/create
router.post("/create", protect, BoardController.create);

// [GET] /api/boards/workspace/:workspaceId
router.get("/workspace/:workspaceId", protect, requireWorkspaceMember, BoardController.getBoardsByWorkspace);

// [GET] /api/boards/:boardId
router.get("/:boardId", protect, requireBoardAccess, BoardController.getBoardById);

// [GET] /api/boards
router.get("/", protect, BoardController.getMyBoards);

module.exports = router;
