const express = require("express");
const router = express.Router();

const requireBoardAccess = require("../middlewares/boardMiddleware");
const BoardController = require("../controllers/BoardController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/create
router.post("/create", protect, BoardController.create);

// [GET] /api/boards/:boardId
router.get("/:boardId", protect, requireBoardAccess, BoardController.getBoardById);

// [GET] /api/boards
router.get("/", protect, BoardController.getMyBoards);

module.exports = router;
