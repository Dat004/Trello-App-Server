const express = require('express');
const router = express.Router();

const authController = require('../controllers/AuthController');

// [POST] /api/auth/register
router.post('/register', authController.register);
// [POST] /api/auth/login
router.post('/login', authController.login);
// [POST] /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
