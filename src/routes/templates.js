const express = require("express");
const router = express.Router();
const TemplateController = require("../controllers/TemplateController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/templates/:templateId/use
router.post("/:templateId/use", protect, TemplateController.createBoardFromTemplate);

// [GET] /api/templates/popular
router.get("/popular", TemplateController.getPopularTemplates);

// [GET] /api/templates/category/:category
router.get("/category/:category", TemplateController.getTemplatesByCategory);

// [GET] /api/templates/:templateId
router.get("/:templateId", TemplateController.getTemplateById);

// [GET] /api/templates
router.get("/", TemplateController.getAllTemplates);

module.exports = router;
