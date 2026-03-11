const express = require("express");
const router = express.Router();
const SearchController = require("../controllers/SearchController");
const protect = require("../middlewares/authMiddleware");

// [GET] /api/search
router.get("/", protect, SearchController.globalSearch);

module.exports = router;
