const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const protect = async (req, res, next) => {
    let token;

    // Lấy token từ cookie
    if(req.cookies && req.cookies.token) token = req.cookies.token;

    if(!token) {
        const err = new Error('Chưa xác thực, vui lòng đăng nhập để tiếp tục');
        err.statusCode = 401;
        return next(err);
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'trello-api',
        });

        // Tìm user theo ID từ token
        const currentUser = await User.findById(decoded.sub).select('+auth_version');
        if (!currentUser) {
            const err = new Error('Người dùng không tồn tại');
            err.statusCode = 401;
            return next(err);
        }
        if ((decoded.ver || 0) !== (currentUser.auth_version || 0)) {
            const err = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
            err.statusCode = 401;
            return next(err);
        }

        // Gán user vào req để các middleware/controller sau có thể sử dụng
        req.user = currentUser;
        next();
    }
    catch(error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            error.statusCode = 401;
        }
        return next(error);
    }
};

module.exports = protect;
