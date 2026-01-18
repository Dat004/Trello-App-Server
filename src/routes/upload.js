const express = require('express');
const router = express.Router();

const UploadController = require('../controllers/UploadController');
const protect = require('../middlewares/authMiddleware');

// [POST] /api/upload/signature
router.post('/signature', protect, UploadController.getUploadSignature);

module.exports = router;
