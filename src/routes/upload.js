const express = require('express');
const router = express.Router();

const { requireBoardAccess } = require('../middlewares/boardMiddleware');
const { requireCardAccess } = require('../middlewares/cardMiddleware');
const UploadController = require('../controllers/UploadController');
const protect = require('../middlewares/authMiddleware');

// [POST] /api/upload/signature
router.post('/signature', protect, requireBoardAccess, requireCardAccess, UploadController.getUploadSignature);

module.exports = router;
