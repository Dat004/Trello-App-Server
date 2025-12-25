const express = require("express");
const router = express.Router();

const WorkspaceController = require("../controllers/WorkspaceController");
const protect = require("../middlewares/authMiddleware");

// [POST] /api/workspaces/create
router.post("/create", protect, WorkspaceController.create);

// GET /api/workspaces
router.get("/", protect, WorkspaceController.getMyWorkspaces);

module.exports = router;
