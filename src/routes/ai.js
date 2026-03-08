const express = require("express");
const router = express.Router();
const AIController = require("../controllers/AIController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/ai/generate-template
router.post("/generate-template", protect, AIController.generateTemplate);

module.exports = router;
