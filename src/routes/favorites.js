const express = require("express");
const router = express.Router();

const FavoritesController = require("../controllers/FavoritesController");
const protect = require("../middlewares/authMiddleware");

// [PATCH] /api/favorites/workspaces/:workspaceId - Toggle star workspace
router.patch("/workspaces/:workspaceId", protect, FavoritesController.toggleStarWorkspace);

// [PATCH] /api/favorites/boards/:boardId - Toggle star board
router.patch("/boards/:boardId", protect, FavoritesController.toggleStarBoard);

// [GET] /api/favorites - Lấy danh sách yêu thích của user
router.get("/", protect, FavoritesController.getMyFavorites);

module.exports = router;
