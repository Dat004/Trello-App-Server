const { z } = require('zod');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Middleware xử lý lỗi
module.exports = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Có lỗi xảy ra, vui lòng thử lại';

    // Xử lý lỗi xác thực Zod
    if (err instanceof z.ZodError) {
        statusCode = 400;
        message = err.issues.map(e => e.message).join(', ');
    }

    // Xử lý lỗi Mongoose
    if (err instanceof mongoose.Error) {
        statusCode = 400;
        message = err.message;
    }

    // Duplicate key error
    if (err.code && err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `${field} đã tồn tại`;
    }

    // Validation error
    if (err instanceof mongoose.Error.ValidationError) {
        statusCode = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }

    // JWT error
    if (err instanceof jwt.JsonWebTokenError) {
        statusCode = 401;
        message = 'Token không hợp lệ';
    }

    if (err instanceof jwt.TokenExpiredError) {
        statusCode = 401;
        message = 'Token đã hết hạn';
    }

    // Gửi phản hồi lỗi
    res.status(statusCode).json({
        success: false,
        message,
    });
};
