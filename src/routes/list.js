const express = require("express");
const router = express.Router({ mergeParams: true });

const authorize = require("../middlewares/permissionMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const PERMISSIONS = require("../permissions/definitions");
const ListController = require("../controllers/ListController");
const protect = require("../middlewares/authMiddleware");

// [DELETE] /api/boards/:boardId/lists/:listId
router.delete('/:listId',
    protect,
    loadContext,
    authorize(PERMISSIONS.LIST.DELETE),
    ListController.deleteList
);

// [PATCH] /api/boards/:boardId/lists/:listId/move
router.patch('/:listId/move',
    protect,
    loadContext,
    authorize(PERMISSIONS.LIST.MOVE),
    ListController.updateListPosition
);

// [PATCH] /api/boards/:boardId/lists/:listId
router.patch('/:listId',
    protect,
    loadContext,
    authorize(PERMISSIONS.LIST.UPDATE),
    ListController.updateList
);

// [POST] /api/boards/:boardId/lists/create
router.post('/create',
    protect,
    loadContext, // Context loaded from :boardId
    authorize(PERMISSIONS.LIST.CREATE),
    ListController.create
);

// [GET] /api/boards/:boardId/lists
router.get('/',
    protect,
    loadContext,
    authorize(PERMISSIONS.BOARD.VIEW),
    ListController.getBoardLists
);

module.exports = router;
