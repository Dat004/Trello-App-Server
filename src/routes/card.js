const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const CardController = require("../controllers/CardController");
const protect = require("../middlewares/authMiddleware");
const {
  requireCardAccess,
  requireCardManage,
} = require("../middlewares/cardMiddleware");

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId
router.delete(
  "/:cardId",
  protect,
  requireBoardAccess,
  requireCardAccess,
  requireCardManage,
  CardController.destroy
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId
router.patch(
  "/:cardId",
  protect,
  requireBoardAccess,
  requireCardAccess,
  requireCardManage,
  CardController.updateInfo
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId/move
router.patch(
  "/:cardId/move",
  protect,
  requireBoardAccess,
  requireCardAccess,
  CardController.moveCard
);

// [POST] /api/boards/:boardId/lists/:listId/cards/create
router.post("/create", protect, requireBoardAccess, CardController.create);

// [GET] /api/boards/:boardId/lists/:listId/cards
router.get("/", protect, requireBoardAccess, CardController.getCardsByList);

module.exports = router;
