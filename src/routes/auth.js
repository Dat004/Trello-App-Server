const express = require('express');
const router = express.Router();

const authController = require('../controllers/AuthController');
const protect = require('../middlewares/authMiddleware');
const { createAuthRateLimit } = require('../middlewares/authRateLimit');

const forgotPasswordLimit = createAuthRateLimit({ max: 5 });
const resetPasswordLimit = createAuthRateLimit({ max: 10 });
const changePasswordLimit = createAuthRateLimit({ max: 10 });

// [POST] /api/auth/register
router.post('/register', authController.register);
// [POST] /api/auth/google
router.post('/google', authController.googleLogin);
// [POST] /api/auth/login
router.post('/login', authController.login);
// [POST] /api/auth/logout
router.post('/logout', authController.logout);
// [POST] /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordLimit, authController.forgotPassword);
// [GET] /api/auth/reset-password/:token/verify
router.get('/reset-password/:token/verify', resetPasswordLimit, authController.verifyResetToken);
// [POST] /api/auth/reset-password
router.post('/reset-password', resetPasswordLimit, authController.resetPassword);
// [POST] /api/auth/change-password
router.post(
    '/change-password',
    changePasswordLimit,
    protect,
    authController.changePassword
);

module.exports = router;
