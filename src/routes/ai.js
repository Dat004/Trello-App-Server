const express = require("express");
const router = express.Router();
const AIController = require("../controllers/AIController");
const protect = require("../middlewares/authMiddleware");
const loadContext = require("../middlewares/contextMiddleware");
const authorize = require("../middlewares/permissionMiddleware");
const PERMISSIONS = require("../permissions/definitions");

// [POST] /api/ai/generate-template
router.post("/generate-template", protect, AIController.generateTemplate);

// [POST] /api/ai/boards/:boardId/analyze
router.post("/boards/:boardId/analyze", protect, loadContext, authorize(PERMISSIONS.BOARD.VIEW), AIController.analyzeBoard);

module.exports = router;
