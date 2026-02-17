const express = require("express");
const router = express.Router({ mergeParams: true });

const authorize = require("../middlewares/permissionMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const PERMISSIONS = require("../permissions/definitions");
const CardController = require("../controllers/CardController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.post(
  "/:cardId/checklist",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.UPDATE),
  CardController.addChecklistItem
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.patch(
  "/:cardId/checklist",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.UPDATE),
  CardController.toggleChecklistItem
);

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId/checklist
router.delete(
  "/:cardId/checklist",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.UPDATE),
  CardController.destroyChecklistItem
);

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId
router.delete(
  "/:cardId",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.DELETE),
  CardController.delete
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId
router.patch(
  "/:cardId",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.UPDATE),
  CardController.updateInfo
);

// [PATCH] /api/boards/:boardId/lists/:listId/cards/:cardId/move
router.patch(
  "/:cardId/move",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.MOVE),
  CardController.moveCard
);

// [GET] /api/boards/:boardId/lists/:listId/cards/:cardId
router.get("/:cardId",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.VIEW),
  CardController.getCardById
);

// [POST] /api/boards/:boardId/lists/:listId/cards/create
router.post("/create",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.CREATE),
  CardController.create
);

// [GET] /api/boards/:boardId/lists/:listId/cards
router.get("/",
  protect,
  loadContext,
  authorize(PERMISSIONS.BOARD.VIEW), // Viewing cards implicitly requires board view
  CardController.getCardsByList
);

// [POST] /api/boards/:boardId/lists/:listId/cards/:cardId/members
router.post(
  "/:cardId/members",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.ASSIGN_MEMBER),
  CardController.assignMember
);

// [DELETE] /api/boards/:boardId/lists/:listId/cards/:cardId/members/:userId
router.delete(
  "/:cardId/members/:userId",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.REMOVE_MEMBER),
  CardController.removeMember
);

// [GET] /api/boards/:boardId/lists/:listId/cards/:cardId/members
router.get(
  "/:cardId/members",
  protect,
  loadContext,
  authorize(PERMISSIONS.CARD.VIEW),
  CardController.getCardMembers
);

module.exports = router;
