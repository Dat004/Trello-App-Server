const express = require("express");
const router = express.Router({ mergeParams: true });

const { requireBoardAccess } = require("../middlewares/boardMiddleware");
const CardController = require("../controllers/CardController");
const protect = require("../middlewares/authMiddleware");
const {
  requireCardAccess,
  requireCardManage,
} = require("../middlewares/cardMiddleware");

// [POST] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.post(
  "/:cardId/checklist",
  protect,
  requireBoardAccess,
  requireCardAccess,
  CardController.addChecklistItem
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.patch(
  "/:cardId/checklist",
  protect,
  requireBoardAccess,
  requireCardAccess,
  CardController.toggleChecklistItem
);

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.delete(
  "/:cardId/checklist",
  protect,
  requireBoardAccess,
  requireCardAccess,
  CardController.destroyChecklistItem
);

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId
router.delete(
  "/:cardId",
  protect,
  requireBoardAccess,
  requireCardAccess,
  requireCardManage,
  CardController.delete
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

// [GET] /api/boards/:boardId/lists/:listId/cards/:cardId
router.get(":cardId", protect, requireBoardAccess, CardController.getCardById);

// [POST] /api/boards/:boardId/lists/:listId/cards/create
router.post("/create", protect, requireBoardAccess, CardController.create);

// [GET] /api/boards/:boardId/lists/:listId/cards
router.get("/", protect, requireBoardAccess, CardController.getCardsByList);

module.exports = router;
