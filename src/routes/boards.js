const express = require("express");
const router = express.Router();

const BoardController = require("../controllers/BoardController");
const protect = require("../middlewares/authMiddleware");
const {
  requireBoardAccess,
  requireBoardAdmin,
} = require("../middlewares/boardMiddleware");

// [PATCH] /api/boards/:boardId
router.patch("/:boardId", protect, requireBoardAccess, requireBoardAdmin, BoardController.updateBoard);

// [POST] /api/boards/create
router.post("/create", protect, BoardController.create);

// [GET] /api/boards/:boardId
router.get("/:boardId", protect, requireBoardAccess, BoardController.getBoardById);

// [GET] /api/boards
router.get("/", protect, BoardController.getMyBoards);

module.exports = router;
