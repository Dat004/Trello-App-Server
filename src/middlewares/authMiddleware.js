const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const protect = async (req, res, next) => {
    let token;

    // Lấy token từ header Authorization: Bearer <token>
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    console.log('Auth Middleware - Token:', token);

    if(!token) {
        const err = new Error('Chưa xác thực, vui lòng đăng nhập để tiếp tục');
        err.statusCode = 401;
        return next(err);
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tìm user theo ID từ token
        const currentUser = await User.findById(decoded.sub);
        if (!currentUser) {
            const err = new Error('Người dùng không tồn tại');
            err.statusCode = 401;
            return next(err);
        }

        // Cập nhật last_logged
        currentUser.last_logged = Date.now();
        await currentUser.save({
            validateBeforeSave: false,
        });

        // Gán user vào req để các middleware/controller sau có thể sử dụng
        req.user = currentUser;
        next();
    }
    catch(error) {
        return next(error);
    }
};

module.exports = protect;
