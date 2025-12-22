const express = require('express');
const router = express.Router();

const userController = require('../controllers/UserController');
const protect = require('../middlewares/authMiddleware');

// [PATCH] /api/users/me/settings
router.patch('/me/settings', protect, userController.updateSettings);

// [PATCH] /api/users/me/info
router.patch('/me/info', protect, userController.updateInfo);

// [GET] /api/users/me
router.get('/me', protect, userController.me);

module.exports = router;
