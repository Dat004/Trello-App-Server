const express = require('express');
const router = express.Router();

const userController = require('../controllers/UserController');
const protect = require('../middlewares/authMiddleware');

// [GET] /api/users/me
router.get('/me', protect, userController.me);

module.exports = router;
